let allEvents = [];
let currentTab = 'upcoming';
const rsvpedEventIds = new Set(JSON.parse(sessionStorage.getItem('cp_rsvped') || '[]'));

function saveRsvpedIds() {
  sessionStorage.setItem('cp_rsvped', JSON.stringify([...rsvpedEventIds]));
}

function renderEvents() {
  const container = document.getElementById('eventsList');
  const emptyState = document.getElementById('eventsEmptyState');

  let list = [...allEvents].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  if (currentTab === 'mine') {
    list = list.filter((e) => rsvpedEventIds.has(String(e.id)));
  } else {
    list = list.filter((e) => new Date(e.starts_at) > new Date());
  }

  container.innerHTML = '';
  emptyState.hidden = list.length > 0;

  list.forEach((ev) => {
    const alreadyRsvped = rsvpedEventIds.has(String(ev.id));
    const card = document.createElement('div');
    card.className = 'card event-card';
    card.innerHTML = `
      <h3>${ev.title}</h3>
      <div class="event-meta">${formatEventTime(ev.starts_at)} · ${ev.location || 'TBA'}</div>
      <p>${ev.description || ''}</p>
      <div class="event-footer">
        <span class="event-rsvp">${ev.rsvp_count} going</span>
        <button data-rsvp="${ev.id}" ${alreadyRsvped ? 'disabled' : ''}>
          ${alreadyRsvped ? "You're in" : 'RSVP'}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function loadEvents() {
  allEvents = await CampusPulseAPI.getEvents();
  renderEvents();
}

document.getElementById('eventsList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-rsvp]');
  if (!btn) return;
  const eventId = btn.dataset.rsvp;
  btn.disabled = true;
  try {
    await CampusPulseAPI.rsvp(eventId);
    rsvpedEventIds.add(eventId);
    saveRsvpedIds();
    showToast('RSVP confirmed');
    await loadEvents();
  } catch (err) {
    showToast('RSVP failed');
    btn.disabled = false;
  }
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderEvents();
  });
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value;
  const location = document.getElementById('eventLocation').value;
  const starts_at = document.getElementById('eventStarts').value;
  const description = document.getElementById('eventDescription').value;

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await CampusPulseAPI.createEvent({ title, location, starts_at, description });
    e.target.reset();
    showToast('Event posted');
    await loadEvents();
  } catch (err) {
    showToast('Could not post event');
  } finally {
    submitBtn.disabled = false;
  }
});

socket.on('rsvp-update', loadEvents);

loadEvents();
setInterval(loadEvents, 15000);
