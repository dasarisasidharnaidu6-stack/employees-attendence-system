# Employee Attendance System — Setup Guide

A minimal end-to-end attendance system using Supabase + plain HTML + Vercel.

---

## 1. Supabase Setup

### A) Create a project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project** → give it a name, set a database password, choose a region.

### B) Enable Email/Password Auth
1. In your project, go to **Authentication → Providers**.
2. Make sure **Email** is enabled (it is by default).
3. Disable "Confirm email" if you want users to log in immediately without verifying — useful for an MVP.

### C) Create the tables
Go to **SQL Editor** and run the following:

```sql
-- Enable UUID extension (usually already enabled)
create extension if not exists "uuid-ossp";

-- Employees table
create table employees (
  id    uuid primary key default uuid_generate_v4(),
  name  text not null,
  email text unique not null,
  role  text not null default 'employee'
    check (role in ('employee', 'admin'))
);

-- Attendance table
create table attendance (
  id          uuid primary key default uuid_generate_v4(),
  employee_id uuid references employees(id) on delete cascade,
  type        text not null check (type in ('checkin', 'checkout')),
  timestamp   timestamptz not null default now(),
  latitude    double precision,
  longitude   double precision
);
```

### D) Row Level Security (RLS) — Simple MVP Policies

Run the following in the SQL Editor:

```sql
-- Enable RLS on both tables
alter table employees  enable row level security;
alter table attendance enable row level security;

-- Employees: allow authenticated users to read their own row
create policy "Employees can read own row"
  on employees for select
  using (email = auth.jwt() ->> 'email');

-- Attendance: employees can insert their own records
create policy "Employees can insert own attendance"
  on attendance for insert
  with check (
    employee_id = (
      select id from employees where email = auth.jwt() ->> 'email'
    )
  );

-- Attendance: admins can read all records
create policy "Admins can read all attendance"
  on attendance for select
  using (
    exists (
      select 1 from employees
      where email = auth.jwt() ->> 'email'
        and role = 'admin'
    )
  );

-- Employees: admins can read all employee rows (needed for the join)
create policy "Admins can read all employees"
  on employees for select
  using (
    exists (
      select 1 from employees e2
      where e2.email = auth.jwt() ->> 'email'
        and e2.role = 'admin'
    )
  );
```

> **Note:** For a simple MVP, you could also just disable RLS temporarily (not recommended for production).

### E) Seed data — create your first users

1. **Create users in Supabase Auth:**
   Go to **Authentication → Users → Add User** for each employee/admin.

2. **Insert matching rows in the employees table** (SQL Editor):

```sql
-- Example employee
insert into employees (name, email, role)
values ('Jane Smith', 'jane@company.com', 'employee');

-- Example admin
insert into employees (name, email, role)
values ('Admin User', 'admin@company.com', 'admin');
```

> The email in the `employees` table **must match** the email used in Supabase Auth.

### F) Get your keys
Go to **Project Settings → API**:
- **Project URL** → this is your `SUPABASE_URL`
- **anon / public** key → this is your `SUPABASE_ANON_KEY`

---

## 2. Configure the App

Open `supabaseClient.js` and replace the placeholders:

```js
const SUPABASE_URL = 'https://xyzxyz.supabase.co';       // ← your project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsIn...';   // ← your anon key
```

---

## 3. Deploy to Vercel

1. Put all files in a folder and push to a GitHub repository:
   ```
   attendance-system/
   ├── index.html
   ├── admin.html
   ├── supabaseClient.js
   ├── app.js
   ├── admin.js
   └── style.css
   ```

2. Go to [https://vercel.com](https://vercel.com) → **Add New Project** → Import your GitHub repo.

3. On the configuration screen:
   - **Framework Preset:** Other
   - **Build Command:** *(leave empty)*
   - **Output Directory:** `.` (root)

4. Click **Deploy**.

5. Vercel automatically serves your site over **HTTPS** — this is required for the browser Geolocation API to work.

---

## 4. File Overview

| File | Purpose |
|---|---|
| `supabaseClient.js` | Initialises and exports the Supabase client |
| `index.html` | Employee login + check-in / check-out UI |
| `app.js` | Employee logic: login, geolocation, insert attendance |
| `admin.html` | Admin login + attendance records table |
| `admin.js` | Admin logic: login, role check, load all records |
| `style.css` | Minimal custom styles (Tailwind is the primary CSS) |

---

## 5. How It Works

**Employee flow:**
1. Open the site → enter email + password → click **Login**.
2. Click **Check In** or **Check Out**.
3. Browser asks for location permission → on approval, the record is saved to Supabase.

**Admin flow:**
1. Open `admin.html` → enter admin email + password → click **Admin Login**.
2. The app verifies your `role = 'admin'` in the `employees` table.
3. All attendance records are loaded into the table, newest first.
