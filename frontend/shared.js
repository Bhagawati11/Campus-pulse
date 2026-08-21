// Shared across all pages: API helpers, socket connection, nav highlighting, userId.
const API_BASE = window.API_BASE || '';
const socket = io(API_BASE || undefined);

// Persist the same fake userId across page navigations within this browser tab.
const userId = sessionStorage.getItem('cp_userId') || (() => {
  const id = 'user-' + Math.floor(Math.random() * 10000);
  sessionStorage.setItem('cp_userId', id);
  return id;
})();

const CampusPulseAPI = {
  getLocations: () => fetch(`${API_BASE}/api/locations`).then((r) => r.json()),
  getEvents: () => fetch(`${API_BASE}/api/events`).then((r) => r.json()),
  checkin: (locationId) =>
    fetch(`${API_BASE}/api/checkins/${locationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).then((r) => r.json()),
  checkout: (locationId) =>
    fetch(`${API_BASE}/api/checkins/${locationId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).then((r) => r.json()),
  createEvent: (payload) =>
    fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  rsvp: (eventId) =>
    fetch(`${API_BASE}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).then((r) => r.json()),
  getCheckinHistory: (limit = 50) =>
    fetch(`${API_BASE}/api/checkins?limit=${limit}`).then((r) => r.json()),
  addLocation: (payload) =>
    fetch(`${API_BASE}/api/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  deleteLocation: (id) =>
    fetch(`${API_BASE}/api/locations/${id}`, { method: 'DELETE' }),
  getRooms: () => fetch(`${API_BASE}/api/rooms`).then((r) => r.json()),
  addRoom: (payload) =>
    fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => r.json()),
  setRoomStatus: (id, status) =>
    fetch(`${API_BASE}/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then((r) => r.json()),
  deleteRoom: (id) => fetch(`${API_BASE}/api/rooms/${id}`, { method: 'DELETE' }),
};

// Given the full locations list and the one the user just checked into,
// returns the least-crowded location in the same category (canteen,
// study, sports, outdoor) — or null if that location wasn't ≥90% full,
// or if it's already the quietest of its category.
function suggestQuieterAlternative(locations, checkedInLocationId) {
  const current = locations.find((l) => String(l.id) === String(checkedInLocationId));
  if (!current || current.percent_full < 90) return null;

  const sameCategory = locations
    .filter((l) => l.category === current.category && String(l.id) !== String(current.id))
    .sort((a, b) => a.percent_full - b.percent_full);

  if (!sameCategory.length) return null;
  const quietest = sameCategory[0];
  return quietest.percent_full < current.percent_full ? quietest : null;
}

// Turns a percent_full number into a status badge {label, className}.
function occupancyStatus(percentFull) {
  if (percentFull >= 90) return { label: 'Full', className: 'status-full' };
  if (percentFull >= 60) return { label: 'High', className: 'status-high' };
  if (percentFull >= 25) return { label: 'Moderate', className: 'status-moderate' };
  return { label: 'Low', className: 'status-low' };
}

function formatEventTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Highlights the current page's nav link. Every page includes <nav> with
// data-nav-links, so this just runs on load on every page.
function highlightActiveNav() {
  const links = document.querySelectorAll('[data-nav-link]');
  const current = window.location.pathname.split('/').pop() || 'index.html';
  links.forEach((link) => {
    if (link.getAttribute('data-nav-link') === current) {
      link.classList.add('active');
    }
  });
}
document.addEventListener('DOMContentLoaded', highlightActiveNav);

// Small toast notification, used across pages for feedback on actions.
function showToast(message) {
  let toast = document.getElementById('cp-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cp-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}
