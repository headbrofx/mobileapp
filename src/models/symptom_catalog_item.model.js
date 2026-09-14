'use strict';

const { Model } = require('sequelize');

// Reference data: the known-symptom catalogue. When a submitted Symptom's
// name matches an entry here (case-insensitively), the submission gets
// enriched with category/triggers/related symptoms and is checked
// against this entry's red-flag thresholds — this is the "structured
// data for Afya AI" the spec asks for.
module.exports = (sequelize, DataTypes) => {
  class SymptomCatalogItem extends Model {
    static associate(models) {
      // Intentionally no FK to Symptom — matching is by name, so a
      // client can log a symptom that isn't in the catalogue yet.
    }
  }

  SymptomCatalogItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      category: {
        type: DataTypes.ENUM(
          'GENERAL',
          'RESPIRATORY',
          'DIGESTIVE',
          'NEUROLOGICAL',
          'CARDIOVASCULAR',
          'MUSCULOSKELETAL',
          'SKIN',
          'OTHER'
        ),
        allowNull: false,
        defaultValue: 'GENERAL',
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      commonTriggers: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'common_triggers' },
      relatedSymptoms: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'related_symptoms' }, // names
      // Red-flag rule metadata (see src/services/symptomRules.service.js):
      alwaysRedFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'always_red_flag' },
      redFlagSeverity: {
        type: DataTypes.ENUM('MILD', 'MODERATE', 'SEVERE'),
        allowNull: true,
        field: 'red_flag_severity',
      }, // flag when reported severity >= this
      redFlagDurationDays: { type: DataTypes.INTEGER, allowNull: true, field: 'red_flag_duration_days' }, // flag when duration >= this many days
    },
    {
      sequelize,
      modelName: 'SymptomCatalogItem',
      tableName: 'symptom_catalog_items',
      underscored: true,
      timestamps: true,
    }
  );

  return SymptomCatalogItem;
};
