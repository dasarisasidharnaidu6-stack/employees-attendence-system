import { supabase } from './supabaseClient.js';

// ── UI helpers ──────────────────────────────────────────────────────────────

function showStatus(message, type = 'info') {

  const wrapper =
    document.getElementById('admin-status');

  const inner =
    document.getElementById('admin-status-inner');

  wrapper.classList.remove('hidden');

  const styles = {
    success: 'border-[#2ecc71] bg-[#f0fff6] text-[#1a5c36]',
    error:   'border-[#e74c3c] bg-[#fff5f5] text-[#7b1f1f]',
    info:    'border-[#4a90d9] bg-[#f0f6ff] text-[#1a3a6e]',
  };

  inner.className =
    `border-2 rounded-sm px-4 py-3 text-sm mono ${styles[type] || styles.info}`;

  inner.textContent = message;
}

// ── Load Teams ──────────────────────────────────────────────────────────────

async function loadTeams() {

  const teamDropdown =
    document.getElementById('filterTeam');

  teamDropdown.innerHTML =
    '<option value="">All Teams</option>';

  const { data, error } = await supabase
    .from('employees')
    .select('team_name');

  if (error) {
    console.error(error);
    return;
  }

  const uniqueTeams = [
    ...new Set(
      data
        .map(emp => emp.team_name?.trim())
        .filter(Boolean)
    )
  ];

  uniqueTeams.forEach((team) => {

    const option =
      document.createElement('option');

    option.value = team;
    option.textContent = team;

    teamDropdown.appendChild(option);
  });
}

// ── Admin Login ─────────────────────────────────────────────────────────────

async function adminLogin() {

  const email =
    document.getElementById('admin-email').value.trim();

  const password =
    document.getElementById('admin-password').value;

  if (!email || !password) {

    showStatus(
      'Please enter your email and password.',
      'error'
    );

    return;
  }

  showStatus('Signing in…', 'info');

  const { error: loginError } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (loginError) {

    showStatus(
      `Login failed: ${loginError.message}`,
      'error'
    );

    return;
  }

  // Verify admin role

  const {
    data: employee,
    error: empError
  } = await supabase
    .from('employees')
    .select('id, name, role')
    .eq('email', email)
    .single();

  if (empError || !employee) {

    showStatus(
      'Employee record not found.',
      'error'
    );

    await supabase.auth.signOut();
    return;
  }

  if (employee.role !== 'admin') {

    showStatus(
      'Access denied: not an admin.',
      'error'
    );

    await supabase.auth.signOut();
    return;
  }

  showStatus(
    `Welcome, ${employee.name}!`,
    'success'
  );

  document
    .getElementById('table-section')
    .classList.remove('hidden');

  await loadTeams();
  await loadAttendance();
}

// ── Load Attendance ────────────────────────────────────────────────────────

async function loadAttendance() {

  const tbody =
    document.getElementById('attendance-body');

  const empty =
    document.getElementById('table-empty');

  tbody.innerHTML = `
    <tr>
      <td colspan="11"
        class="text-center py-8 text-gray-400 mono text-sm">
        Loading…
      </td>
    </tr>
  `;

  empty.classList.add('hidden');

  const selectedDate =
    document.getElementById('filterDate').value;

  const selectedTeam =
    document.getElementById('filterTeam').value;

  let query = supabase
    .from('attendance')
    .select(`
      id,
      type,
      timestamp,
      latitude,
      longitude,
      address,
      description,
      session_number,
      team_name,
      work_mode,
      employees (
        name,
        email
      )
    `)
    .order('timestamp', {
      ascending: false
    });

  // Date filter

  if (selectedDate) {

    const start =
      new Date(selectedDate);

    start.setHours(0,0,0,0);

    const end =
      new Date(selectedDate);

    end.setHours(23,59,59,999);

    query = query
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString());
  }

  // Team filter

  if (selectedTeam) {
    query = query.eq('team_name', selectedTeam);
  }

  const {
    data: records,
    error
  } = await query;

  if (error) {

    tbody.innerHTML = `
      <tr>
        <td colspan="11"
          class="text-center py-8 text-red-400 mono text-sm">
          Error: ${error.message}
        </td>
      </tr>
    `;

    return;
  }

  if (!records || records.length === 0) {

    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  tbody.innerHTML = records.map((record) => {

    const name =
      record.employees?.name ?? '—';

    const email =
      record.employees?.email ?? '—';

    const team =
      record.team_name ?? '—';

    const workMode =
      record.work_mode ?? '—';

    const type =
      record.type ?? '—';

    const session =
      record.session_number ?? '—';

    const description =
      record.description ?? '—';

    const address =
      record.address ?? '—';

    const time =
      new Date(record.timestamp)
        .toLocaleString();

    const lat =
      record.latitude != null
        ? record.latitude.toFixed(6)
        : '—';

    const lng =
      record.longitude != null
        ? record.longitude.toFixed(6)
        : '—';

    const typeBadge =
      type === 'checkin'
        ? `
          <span class="inline-block bg-[#2ecc71] text-[#1a1a2e]
            text-xs font-bold mono px-2 py-0.5 rounded-sm uppercase">
            In
          </span>
        `
        : `
          <span class="inline-block bg-[#e74c3c] text-white
            text-xs font-bold mono px-2 py-0.5 rounded-sm uppercase">
            Out
          </span>
        `;

    return `
      <tr class="hover:bg-white/5 transition-colors">

        <td class="px-4 py-3 text-[#f0ede8] font-medium">
          ${escapeHtml(name)}
        </td>

        <td class="px-4 py-3 text-gray-300 mono text-xs">
          ${escapeHtml(email)}
        </td>

        <td class="px-4 py-3 text-cyan-300 mono text-xs">
          ${escapeHtml(team)}
        </td>

        <td class="px-4 py-3 text-yellow-300 mono text-xs">
          ${escapeHtml(workMode)}
        </td>

        <td class="px-4 py-3">
          ${typeBadge}
        </td>

        <td class="px-4 py-3 text-gray-300 mono text-xs">
          ${session}
        </td>

        <td class="px-4 py-3 text-gray-300 text-xs max-w-[250px]">
          ${escapeHtml(description)}
        </td>

        <td class="px-4 py-3 text-gray-300 text-xs max-w-[300px]">
          ${escapeHtml(address)}
        </td>

        <td class="px-4 py-3 text-gray-300 mono text-xs whitespace-nowrap">
          ${time}
        </td>

        <td class="px-4 py-3 text-gray-300 mono text-xs">
          ${lat}
        </td>

        <td class="px-4 py-3 text-gray-300 mono text-xs">
          ${lng}
        </td>

      </tr>
    `;
  }).join('');
}

// ── Escape HTML ─────────────────────────────────────────────────────────────

function escapeHtml(str) {

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event Listeners ─────────────────────────────────────────────────────────

document
  .getElementById('adminLoginBtn')
  .addEventListener('click', adminLogin);

document
  .getElementById('admin-password')
  .addEventListener('keydown', (e) => {

    if (e.key === 'Enter') {
      adminLogin();
    }
  });

document
  .getElementById('refreshBtn')
  .addEventListener('click', loadAttendance);

document
  .getElementById('filterDate')
  .addEventListener('change', loadAttendance);

document
  .getElementById('filterTeam')
  .addEventListener('change', loadAttendance);