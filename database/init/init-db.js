// MongoDB Initialization Script
// Runs automatically on first container start

db = db.getSiblingDB('appdb');

// Create collections
db.createCollection('items');
db.createCollection('logs');

// Create indexes for performance
db.items.createIndex({ "name": 1 });
db.items.createIndex({ "created_at": -1 });
db.logs.createIndex({ "timestamp": -1 });

// Seed initial demo data
db.items.insertMany([
    {
        name: "Sample Item 1",
        description: "First demo item — inserted by init script",
        created_at: new Date().toISOString(),
        server_id: "init-script"
    },
    {
        name: "Sample Item 2",
        description: "Second demo item — verifies database connectivity",
        created_at: new Date().toISOString(),
        server_id: "init-script"
    },
    {
        name: "Sample Item 3",
        description: "Third demo item — ready for load balancer testing",
        created_at: new Date().toISOString(),
        server_id: "init-script"
    }
]);

print("✅ Database 'appdb' initialized with seed data and indexes!");
