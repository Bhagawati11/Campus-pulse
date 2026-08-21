function renderLocationsTable(locations) {
  const tbody = document.getElementById('locationsTableBody');
  tbody.innerHTML = '';
  locations.forEach((loc) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${loc.name}</td>
      <td>${loc.capacity}</td>
      <td>${loc.occupancy}</td>
      <td><button class="secondary" data-delete="${loc.id}">Remove</button></td>
    `;
    tbody.appendChild(row);
  });
}

function renderCheckinsTable(checkins) {
  const tbody = document.getElementById('checkinsTableBody');
  const emptyState = document.getElementById('checkinsEmptyState');
  tbody.innerHTML = '';
  emptyState.hidden = checkins.length > 0;

  checkins.forEach((c) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${c.user_id}</td>
      <td>${c.location_name}</td>
      <td>${new Date(c.checked_in_at).toLocaleString()}</td>
      <td>${c.checked_out_at ? new Date(c.checked_out_at).toLocaleString() : '—'}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderRoomsTable(rooms) {
  const tbody = document.getElementById('roomsTableBody');
  tbody.innerHTML = '';
  rooms.forEach((room) => {
    const isEmpty = room.status === 'empty';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${room.name}</td>
      <td>${room.building}</td>
      <td>${room.room_type === 'lab' ? 'Lab' : 'Classroom'}</td>
      <td><span class="badge ${isEmpty ? 'status-low' : 'status-full'}">${isEmpty ? 'Empty' : 'Occupied'}</span></td>
      <td>
        <button class="secondary" data-toggle="${room.id}" data-current="${room.status}">
          Mark ${isEmpty ? 'Occupied' : 'Empty'}
        </button>
        <button class="secondary" data-delete-room="${room.id}">Remove</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function loadRoomsTable() {
  const rooms = await CampusPulseAPI.getRooms();
  renderRoomsTable(rooms);
}

document.getElementById('addRoomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('newRoomName').value;
  const building = document.getElementById('newRoomBuilding').value;
  const room_type = document.getElementById('newRoomType').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await CampusPulseAPI.addRoom({ name, building, room_type });
    e.target.reset();
    showToast('Room added');
    await loadRoomsTable();
  } catch (err) {
    showToast('Could not add room');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('roomsTableBody').addEventListener('click', async (e) => {
  const toggleBtn = e.target.closest('button[data-toggle]');
  const deleteBtn = e.target.closest('button[data-delete-room]');

  if (toggleBtn) {
    const nextStatus = toggleBtn.dataset.current === 'empty' ? 'occupied' : 'empty';
    toggleBtn.disabled = true;
    try {
      await CampusPulseAPI.setRoomStatus(toggleBtn.dataset.toggle, nextStatus);
      await loadRoomsTable();
    } catch (err) {
      showToast('Could not update room');
      toggleBtn.disabled = false;
    }
  }

  if (deleteBtn) {
    if (!confirm('Remove this room?')) return;
    deleteBtn.disabled = true;
    try {
      await CampusPulseAPI.deleteRoom(deleteBtn.dataset.deleteRoom);
      showToast('Room removed');
      await loadRoomsTable();
    } catch (err) {
      showToast('Could not remove room');
      deleteBtn.disabled = false;
    }
  }
});

socket.on('room-update', loadRoomsTable);

async function loadAdminData() {
  const [locations, checkins] = await Promise.all([
    CampusPulseAPI.getLocations(),
    CampusPulseAPI.getCheckinHistory(50),
  ]);
  renderLocationsTable(locations);
  renderCheckinsTable(checkins);
  await loadRoomsTable();
}

document.getElementById('addLocationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('newLocationName').value;
  const capacity = document.getElementById('newLocationCapacity').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await CampusPulseAPI.addLocation({ name, capacity: Number(capacity) });
    e.target.reset();
    showToast('Location added');
    await loadAdminData();
  } catch (err) {
    showToast('Could not add location');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('locationsTableBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-delete]');
  if (!btn) return;
  if (!confirm('Remove this location and its check-in history?')) return;
  btn.disabled = true;
  try {
    await CampusPulseAPI.deleteLocation(btn.dataset.delete);
    showToast('Location removed');
    await loadAdminData();
  } catch (err) {
    showToast('Could not remove location');
    btn.disabled = false;
  }
});

socket.on('occupancy-update', loadAdminData);

loadAdminData();
setInterval(loadAdminData, 15000);
