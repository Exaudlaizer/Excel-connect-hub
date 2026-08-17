const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CommunityPost = sequelize.define(
  "CommunityPost",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(180),
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM("discussion", "question", "announcement", "group", "event"),
      allowNull: false,
      defaultValue: "discussion"
    },
    // Only an admin may pin. Pinned posts are what the dashboard surfaces as
    // announcements, so this is deliberately not something a member can set.
    pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    tableName: "community_posts",
    indexes: [
      { name: "community_posts_author_id_idx", fields: ["authorId"] },
      { name: "community_posts_category_idx", fields: ["category"] }
    ]
  }
);

CommunityPost.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

module.exports = CommunityPost;
