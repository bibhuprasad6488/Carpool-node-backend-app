const db = require('../../config/db');

class SiteSetting {
  // Get the single settings record (creates one if table is empty)
  static async getSettings() {
    const [rows] = await db.query('SELECT * FROM site_settings ORDER BY id ASC LIMIT 1');
    if (rows.length === 0) {
      // Initialize an empty row if none exists
      await db.query("SET time_zone = '+05:30'");

      const [result] = await db.query('INSERT INTO site_settings (created_at) VALUES (NOW())');
      const [newRows] = await db.query('SELECT * FROM site_settings WHERE id = ?', [result.insertId]);
      return newRows[0];
    }
    return rows[0];
  }

  // Get only the commission rate
  static async getCommission() {
    const [rows] = await db.query('SELECT commision FROM site_settings ORDER BY id ASC LIMIT 1');
    return rows.length > 0 ? rows[0].commision : '0';
  }

  // Update only the commission rate
  static async updateCommission(commissionValue) {
    const settings = await this.getSettings();
    await db.query(
      'UPDATE site_settings SET commision = ?, updated_at = NOW() WHERE id = ?',
      [commissionValue, settings.id]
    );
    return true;
  }

  // Update full site settings dynamic fields
  static async updateSettings(updateData) {
    const settings = await this.getSettings();

    // Filter out undefined values to update only provided fields
    const fields = [];
    const values = [];

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateData[key]);
      }
    });

    if (fields.length === 0) return settings;

    fields.push('updated_at = NOW()');
    values.push(settings.id);

    const sql = `UPDATE site_settings SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);

    return this.getSettings();
  }
}

module.exports = SiteSetting;