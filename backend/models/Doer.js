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
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Approval flow fields
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  approvalStatus: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    defaultValue: 'APPROVED'
  },
  approvedBy: {
    type: DataTypes.STRING, // Stores approver's name (not telegramId)
    allowNull: true
  }

});

module.exports = Doer;
