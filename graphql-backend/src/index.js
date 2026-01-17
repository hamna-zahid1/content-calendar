const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const cors = require('cors');
require('dotenv').config();

const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { initializeDatabase } = require('./db/init');
const { getUser } = require('./utils/auth');

const PORT = process.env.PORT || 4000;

async function startServer() {
  const app = express();

  // CORS configuration
  app.use(cors({
    origin: '*',
    credentials: true
  }));

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Initialize database
  await initializeDatabase();

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const user = getUser(req);
      return { user };
    },
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
      };
    },
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Server running on http://0.0.0.0:${PORT}`);
    console.log(`\n✅ GraphQL endpoint: http://0.0.0.0:${PORT}/graphql`);
    console.log(`\n✅ Health check: http://0.0.0.0:${PORT}/health`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});