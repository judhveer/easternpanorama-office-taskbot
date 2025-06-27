const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Doer = sequelize.define('Doer', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('name', value.toUpperCase());
    }
  },
  telegramId: {
    type: DataTypes.BIGINT, // Telegram chat/user ID
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

module.exports = Doer;
