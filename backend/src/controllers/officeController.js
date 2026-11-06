import { db } from '../db.js';

export function getOfficeLocations(req, res) {
  const offices = db.prepare('SELECT * FROM office_locations ORDER BY is_active DESC').all();
  res.json({ offices });
}

export function updateOfficeLocation(req, res) {
  const { id } = req.params;
  const { name, latitude, longitude, radius_meters, address, wifi_validation_enabled, allowed_wifi_ssids, allowed_ip_ranges } = req.body;

  const existing = db.prepare('SELECT * FROM office_locations WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Office location not found' });
  }

  db.prepare(`
    UPDATE office_locations SET
      name = COALESCE(?, name),
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      radius_meters = COALESCE(?, radius_meters),
      address = COALESCE(?, address),
      wifi_validation_enabled = COALESCE(?, wifi_validation_enabled),
      allowed_wifi_ssids = COALESCE(?, allowed_wifi_ssids),
      allowed_ip_ranges = COALESCE(?, allowed_ip_ranges)
    WHERE id = ?
  `).run(
    name || null,
    latitude !== undefined ? parseFloat(latitude) : null,
    longitude !== undefined ? parseFloat(longitude) : null,
    radius_meters !== undefined ? parseFloat(radius_meters) : null,
    address || null,
    wifi_validation_enabled !== undefined ? (wifi_validation_enabled ? 1 : 0) : null,
    allowed_wifi_ssids !== undefined ? allowed_wifi_ssids : null,
    allowed_ip_ranges !== undefined ? allowed_ip_ranges : null,
    id
  );

  const updated = db.prepare('SELECT * FROM office_locations WHERE id = ?').get(id);
  res.json({ message: 'Office settings updated successfully', office: updated });
}

export function getNetworkSettings(req, res) {
  const office = db.prepare('SELECT id, name, wifi_validation_enabled, allowed_wifi_ssids, allowed_ip_ranges FROM office_locations WHERE is_active = 1 LIMIT 1').get();
  res.json({
    settings: {
      wifi_validation_enabled: Boolean(office?.wifi_validation_enabled),
      allowed_wifi_ssids: office?.allowed_wifi_ssids || 'UnitedSoft-WiFi,UnitedSoft-Corp,Office-WiFi',
      allowed_ip_ranges: office?.allowed_ip_ranges || ''
    }
  });
}

export function updateNetworkSettings(req, res) {
  const { wifi_validation_enabled, allowed_wifi_ssids, allowed_ip_ranges } = req.body;

  const office = db.prepare('SELECT id FROM office_locations WHERE is_active = 1 LIMIT 1').get();
  if (!office) {
    return res.status(404).json({ error: 'Active office location not found' });
  }

  db.prepare(`
    UPDATE office_locations SET
      wifi_validation_enabled = COALESCE(?, wifi_validation_enabled),
      allowed_wifi_ssids = COALESCE(?, allowed_wifi_ssids),
      allowed_ip_ranges = COALESCE(?, allowed_ip_ranges)
    WHERE id = ?
  `).run(
    wifi_validation_enabled !== undefined ? (wifi_validation_enabled ? 1 : 0) : null,
    allowed_wifi_ssids !== undefined ? allowed_wifi_ssids : null,
    allowed_ip_ranges !== undefined ? allowed_ip_ranges : null,
    office.id
  );

  const updated = db.prepare('SELECT id, name, wifi_validation_enabled, allowed_wifi_ssids, allowed_ip_ranges FROM office_locations WHERE id = ?').get(office.id);
  res.json({
    message: 'Company network validation settings updated successfully',
    settings: {
      wifi_validation_enabled: Boolean(updated.wifi_validation_enabled),
      allowed_wifi_ssids: updated.allowed_wifi_ssids,
      allowed_ip_ranges: updated.allowed_ip_ranges
    }
  });
}

export function setOfficeToCurrentLocation(req, res) {
  const { latitude, longitude, radius_meters } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  const office = db.prepare('SELECT id FROM office_locations WHERE is_active = 1 LIMIT 1').get();
  if (office) {
    db.prepare(`
      UPDATE office_locations SET
        latitude = ?,
        longitude = ?,
        radius_meters = COALESCE(?, radius_meters)
      WHERE id = ?
    `).run(parseFloat(latitude), parseFloat(longitude), radius_meters ? parseFloat(radius_meters) : null, office.id);
  }

  const updated = db.prepare('SELECT * FROM office_locations WHERE is_active = 1 LIMIT 1').get();
  res.json({
    message: 'Office geofence synced to specified coordinates',
    office: updated
  });
}
