const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CommunityReply = sequelize.define(
  "CommunityReply",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    postId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  },
  {
    tableName: "community_replies",
    indexes: [
      { name: "community_replies_post_id_idx", fields: ["postId", "createdAt"] },
      { name: "community_replies_author_id_idx", fields: ["authorId"] }
    ]
  }
);

CommunityReply.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = CommunityReply;
