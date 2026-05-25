import { supabase } from './supabaseClient.js';

// ── Load Employees & Teams ───────────────────────────────────────────────

async function loadEmployees() {

  const employeeDropdown =
    document.getElementById('employeeName');

  const teamDropdown =
    document.getElementById('teamName');

  // Clear old options
  employeeDropdown.innerHTML =
    '<option value="">Select Employee</option>';

  teamDropdown.innerHTML =
    '<option value="">Select Team</option>';

  const { data, error } = await supabase
    .from('employees')
    .select('name, team_name');

  if (error) {
    console.error(error);
    return;
  }

  const addedTeams = new Set();

  data.forEach((employee) => {

    // Employee names
    const option =
      document.createElement('option');

    option.value = employee.name;
    option.textContent = employee.name;

    employeeDropdown.appendChild(option);

    // Team names
    if (
      employee.team_name &&
      !addedTeams.has(employee.team_name)
    ) {

      addedTeams.add(employee.team_name);

      const teamOption =
        document.createElement('option');

      teamOption.value = employee.team_name;
      teamOption.textContent = employee.team_name;

      teamDropdown.appendChild(teamOption);
    }
  });
}

// ── Get Address from Coordinates ────────────────────────────────────────

async function getAddress(lat, lng) {

  try {

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );

    const data = await response.json();

    return data.display_name || 'Address not found';

  } catch (err) {

    return 'Unable to fetch address';
  }
}

// ── UI Status ───────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {

  const wrapper =
    document.getElementById('status');

  const inner =
    document.getElementById('status-inner');

  wrapper.classList.remove('hidden');

  const styles = {
    success:
      'border-[#2ecc71] bg-[#f0fff6] text-[#1a5c36]',

    error:
      'border-[#e74c3c] bg-[#fff5f5] text-[#7b1f1f]',

    info:
      'border-[#4a90d9] bg-[#f0f6ff] text-[#1a3a6e]',
  };

  inner.className =
    `border-2 rounded-sm px-4 py-3 text-sm mono ${styles[type]}`;

  inner.textContent = message;
}

// ── Login ───────────────────────────────────────────────────────────────

async function login() {

  const email =
    document.getElementById('email').value.trim();

  const password =
    document.getElementById('password').value;

  if (!email || !password) {

    showStatus(
      'Please enter email and password.',
      'error'
    );

    return;
  }

  showStatus('Signing in...', 'info');

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {

    showStatus(
      `Login failed: ${error.message}`,
      'error'
    );

    return;
  }

  showStatus(
    'Login successful! You can now mark attendance.',
    'success'
  );
}

// ── Attendance ──────────────────────────────────────────────────────────

async function markAttendance(type) {

  // Check login
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {

    showStatus(
      'Please login first.',
      'error'
    );

    return;
  }

  // Form values
  const employeeName =
    document.getElementById('employeeName').value;

  const teamName =
    document.getElementById('teamName').value;

  const workModeElement =
    document.querySelector(
      'input[name="workMode"]:checked'
    );

  const description =
    document.getElementById('description')
      .value
      .trim();

  if (!employeeName || !teamName) {

    showStatus(
      'Please select employee and team.',
      'error'
    );

    return;
  }

  if (!workModeElement) {

    showStatus(
      'Please select work mode.',
      'error'
    );

    return;
  }

  const workMode =
    workModeElement.value;

  // Description mandatory
  if (!description) {

    showStatus(
      'Please enter work description.',
      'error'
    );

    return;
  }

  showStatus(
    'Requesting location...',
    'info'
  );

  // Geolocation
  if (!navigator.geolocation) {

    showStatus(
      'Geolocation not supported.',
      'error'
    );

    return;
  }

  navigator.geolocation.getCurrentPosition(

    async (position) => {

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      showStatus(
        'Location acquired. Recording attendance...',
        'info'
      );

      // Get employee details
      const {
        data: employee,
        error: empError
      } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single();

      if (empError || !employee) {

        showStatus(
          'Employee record not found.',
          'error'
        );

        return;
      }

      // Today's records
      const today =
        new Date().toISOString().split('T')[0];

      const {
        data: todayRecords,
        error: todayError
      } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id);

      if (todayError) {

        showStatus(
          'Failed to check sessions.',
          'error'
        );

        return;
      }

      const todayCount =
        todayRecords.filter((record) =>
          record.timestamp.startsWith(today)
        ).length;

      if (todayCount >= 6) {

        showStatus(
          'Maximum 6 sessions completed.',
          'error'
        );

        return;
      }

      const sessionNumber =
        todayCount + 1;

      // Update counter
      document.getElementById(
        'sessionCounter'
      ).innerText =
        `Session: ${sessionNumber} / 6`;

      // Address
      const address =
        await getAddress(latitude, longitude);

      // Insert attendance
      const {
        error: insertError
      } = await supabase
        .from('attendance')
        .insert([
          {
            employee_id: employee.id,
            employee_name: employeeName,
            team_name: teamName,
            work_mode: workMode,
            type: type,
            timestamp: new Date().toISOString(),
            latitude: latitude,
            longitude: longitude,
            address: address,
            description: description,
            session_number: sessionNumber
          }
        ]);

      if (insertError) {

        console.error(insertError);

        showStatus(
          `Attendance failed: ${insertError.message}`,
          'error'
        );

        return;
      }

      const label =
        type === 'checkin'
          ? 'Check-in'
          : 'Check-out';

      showStatus(
        `${label} recorded successfully!`,
        'success'
      );

      // Clear description
      document.getElementById(
        'description'
      ).value = '';
    },

    (error) => {

      showStatus(
        'Unable to retrieve location.',
        'error'
      );
    }
  );
}

// ── Event Listeners ─────────────────────────────────────────────────────

document
  .getElementById('loginBtn')
  .addEventListener('click', login);

document
  .getElementById('checkInBtn')
  .addEventListener(
    'click',
    () => markAttendance('checkin')
  );

document
  .getElementById('checkOutBtn')
  .addEventListener(
    'click',
    () => markAttendance('checkout')
  );

document
  .getElementById('password')
  .addEventListener('keydown', (e) => {

    if (e.key === 'Enter') {
      login();
    }
  });

// Initial load
loadEmployees();