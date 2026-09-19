'use strict';

const { Model } = require('sequelize');

// A day's body check-in, for Orbit.
//
// Every field except the person and the date is nullable, and that is
// the design rather than laziness: a check-in that insists on eleven
// answers is one nobody finishes, and a half-filled row is still true.
// Null means "not answered" and never means zero — the pattern engine
// depends on being able to tell those apart, because averaging silence
// as zero would invent a decline that nobody reported.
module.exports = (sequelize, DataTypes) => {
  class OrbitCheckin extends Model {
    static associate(models) {
      OrbitCheckin.belongsTo(models.FamilyMember, {
        foreignKey: 'familyMemberId',
        as: 'familyMember',
      });
    }
  }

  OrbitCheckin.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      familyMemberId: { type: DataTypes.UUID, allowNull: false, field: 'family_member_id' },
      // The day reported on, not the moment typed.
      checkinDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'checkin_date' },

      mood: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
      energy: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
      sleep: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
      appetite: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
      // 0 is an answer — "no pain today" — so the floor is 0, not 1.
      pain: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0, max: 5 } },

      flow: {
        type: DataTypes.ENUM('NONE', 'SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY'),
        allowNull: true,
      },

      symptoms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'OrbitCheckin',
      tableName: 'orbit_checkins',
      underscored: true,
      timestamps: true,
    }
  );

  return OrbitCheckin;
};
