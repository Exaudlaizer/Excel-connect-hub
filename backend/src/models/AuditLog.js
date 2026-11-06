const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * A record of something an administrator did, or a security-relevant event, so
 * that "who approved that?" and "when did this account get suspended?" have an
 * answer. Rows are only ever added.
 *
 * `actorEmail` is a snapshot: the account can be deleted later (the link is then
 * nulled) but the trail should still say who acted.
 *
 * `details` holds small facts only (old and new values, ids). Never put tokens,
 * passwords, reset links or request bodies in it.
 */
const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actorId: { type: DataTypes.UUID, allowNull: true },
    actorEmail: { type: DataTypes.STRING(255), allowNull: true },
    action: { type: DataTypes.STRING(80), allowNull: false },
    targetType: { type: DataTypes.STRING(40), allowNull: true },
    targetId: { type: DataTypes.STRING(80), allowNull: true },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ip: { type: DataTypes.STRING(64), allowNull: true }
  },
  {
    tableName: "audit_logs",
    updatedAt: false,
    indexes: [
      { name: "audit_logs_created_idx", fields: ["createdAt"] },
      { name: "audit_logs_actor_idx", fields: ["actorId"] },
      { name: "audit_logs_action_idx", fields: ["action"] },
      { name: "audit_logs_target_idx", fields: ["targetType", "targetId"] }
    ]
  }
);

module.exports = AuditLog;
