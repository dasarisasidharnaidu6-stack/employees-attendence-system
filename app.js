import { supabase } from './supabaseClient.js';

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
// ── UI helpers ──────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {
  const wrapper = document.getElementById('status');
  const inner = document.getElementById('status-inner');
  wrapper.classList.remove('hidden');

  const styles = {
    success: 'border-[#2ecc71] bg-[#f0fff6] text-[#1a5c36]',
    error:   'border-[#e74c3c] bg-[#fff5f5] text-[#7b1f1f]',
    info:    'border-[#4a90d9] bg-[#f0f6ff] text-[#1a3a6e]',
  };

  inner.className = `border-2 rounded-sm px-4 py-3 text-sm mono ${styles[type] || styles.info}`;
  inner.textContent = message;
}

// ── Login ───────────────────────────────────────────────────────────────────

async function login() {
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showStatus('Please enter your email and password.', 'error');
    return;
  }

  showStatus('Signing in…', 'info');

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showStatus(`Login failed: ${error.message}`, 'error');
    return;
  }

  showStatus('Logged in successfully! You can now check in or out.', 'success');
}

// ── Mark attendance ──────────────────────────────────────────────────────────

async function markAttendance(type) {
  // 1. Confirm user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    showStatus('Please log in first.', 'error');
    return;
  }

  showStatus('Requesting your location…', 'info');

  // 2. Get geolocation
  if (!navigator.geolocation) {
    showStatus('Geolocation is not supported by your browser.', 'error');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude  = position.coords.latitude;
      const longitude = position.coords.longitude;

      showStatus('Location acquired. Recording attendance…', 'info');

      // 3. Fetch the employee row for this user
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, name, email, role')
        .eq('email', user.email)
        .single();

      if (empError || !employee) {
        showStatus('Employee record not found. Contact your admin.', 'error');
        return;
      }

      // 4. Check today's session count
        const today = new Date().toISOString().split('T')[0];

        const { data: todayRecords, error: todayError } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', employee.id);

        if (todayError) {
          showStatus('Failed to check today sessions.', 'error');
          return;
        }

        const todayCount = todayRecords.filter((record) => {
          return record.timestamp.startsWith(today);
        }).length;

        // Maximum 6 sessions
        if (todayCount >= 6) {
          showStatus('You already completed all 6 sessions today.', 'error');
          return;
        }

        // Update session counter
        document.getElementById('sessionCounter').innerText =
          `Session: ${todayCount + 1} / 6`;

        // Get description
        const description = document.getElementById('description').value.trim();

        // Make description mandatory during checkout
        if (type === 'checkout' && !description) {
          showStatus(
            'Please describe what you worked on in the last hour.',
            'error'
          );
          return;
        }

        // Convert coordinates to address
        const address = await getAddress(latitude, longitude);

        // Insert attendance
        const { error: insertError } = await supabase
          .from('attendance')
          .insert({
            employee_id: employee.id,
            type,
            timestamp: new Date().toISOString(),
            latitude,
            longitude,
            address,
            description,
            session_number: todayCount + 1
          });

        if (insertError) {
          showStatus(
            `Failed to record attendance: ${insertError.message}`,
            'error'
          );
          return;
        }

        const label = type === 'checkin'
          ? 'Check-in'
          : 'Check-out';

        showStatus(`${label} recorded successfully.`, 'success');
      },
      (positionError) => {
        showStatus('Unable to retrieve your location.', 'error');
      }
    );
  }

// ── Wire up buttons ──────────────────────────────────────────────────────────

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('checkInBtn').addEventListener('click', () => markAttendance('checkin'));
document.getElementById('checkOutBtn').addEventListener('click', () => markAttendance('checkout'));

// Allow pressing Enter in password field to login
document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});
