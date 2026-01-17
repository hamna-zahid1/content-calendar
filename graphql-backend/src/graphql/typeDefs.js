const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type ContentPlan {
    id: ID!
    name: String!
    niche: String!
    platform: String!
    goal: String!
    tone: String!
    posts: [Post!]!
    createdAt: String!
    updatedAt: String!
  }

  type Post {
    id: ID!
    planId: ID!
    day: Int!
    date: String!
    format: String!
    caption: String!
    hashtags: [String!]!
    status: String!
    scheduledAt: String
  }

  type ExportPayload {
    data: String!
    format: String!
  }

  type RateLimitInfo {
    allowed: Boolean!
    remaining: Int!
    retryAfter: Int
  }

  input CreatePlanInput {
    name: String!
    niche: String!
    platform: String!
    goal: String!
    tone: String!
  }

  input UpdatePostInput {
    postId: ID!
    caption: String
    hashtags: [String!]
    scheduledAt: String
    status: String
  }

  type Query {
    me: User
    getPlans: [ContentPlan!]!
    getPlan(id: ID!): ContentPlan
  }

  type Mutation {
    signup(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createPlan(input: CreatePlanInput!): ContentPlan!
    generateCalendar(planId: ID!): ContentPlan!
    updatePost(input: UpdatePostInput!): Post!
    deletePlan(id: ID!): Boolean!
    exportPlan(id: ID!, format: String!): ExportPayload!
  }
`;

module.exports = typeDefs;