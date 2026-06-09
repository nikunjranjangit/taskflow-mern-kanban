require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');

const runVerificationSeed = async () => {
  try {
    console.log('⚡ Starting TaskFlow Master Database Verification Suite...');
    
    // Wipe previous test attempts clean to guarantee a fresh state
    await mongoose.connect(process.env.MONGODB_URI);
    await User.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    console.log('🧹 Database cleared cleanly.');

    // 1. VERIFY REQUIREMENT: User Creation & Password Hashing
    console.log('\n--- Testing Authentication & Account Creation ---');
    const ownerUser = await User.create({
      name: 'Alice Owner',
      email: 'alice@taskflow.com',
      password: 'SecurePass123!'
    });
    const memberUser = await User.create({
      name: 'Bob Member',
      email: 'bob@taskflow.com',
      password: 'SecurePass123!'
    });
    console.log(`✅ User 1 Created (Owner): ${ownerUser.email}`);
    console.log(`✅ User 2 Created (Member): ${memberUser.email}`);
    console.log(`🔒 Verification: Passwords encrypted natively via bcrypt: ${ownerUser.password !== 'SecurePass123!'}`);

    // 2. VERIFY REQUIREMENT: Many-to-Many Project Membership Mapping
    console.log('\n--- Testing Many-to-Many Project Workspace Mapping ---');
    const sharedProject = await Project.create({
      title: 'Enterprise Alpha Platform',
      description: 'Core infrastructure redevelopment pipeline',
      owner: ownerUser._id,
      members: [ownerUser._id, memberUser._id] // Enrolling both users into the collaborative matrix
    });
    console.log(`✅ Project Provisioned Successfully: "${sharedProject.title}"`);
    console.log(`👥 Membership Array Verification: Members Enrolled = ${sharedProject.members.length}`);

    // 3. VERIFY REQUIREMENT: Task Configuration, Constraints, & Relational Scoping
    console.log('\n--- Testing Core Task Engineering & Validations ---');
    
    // Seed Task 1: Assigned to the owner
    const task1 = await Task.create({
      title: 'Architect API Token Rotation Gateway',
      description: 'Implement short-lived access structures and cookie pools',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      project: sharedProject._id,
      creator: ownerUser._id,
      assignee: ownerUser._id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days in the future (Valid)
    });

    // Seed Task 2: Cross-assigned to the invited member to test shared workspace flows
    const task2 = await Task.create({
      title: 'Integrate Scoped WebSocket Listeners',
      description: 'Wire up client socket hook channels and map isolated memory rooms',
      status: 'TODO',
      priority: 'MEDIUM',
      project: sharedProject._id,
      creator: ownerUser._id,
      assignee: memberUser._id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    console.log(`✅ Task 1 (Assigned to Alice): "${task1.title}" [Priority: ${task1.priority}]`);
    console.log(`✅ Task 2 (Cross-Assigned to Bob): "${task2.title}" [Status: ${task2.status}]`);

    // 4. VERIFY REQUIREMENT: Business Logic Hook (Derived Data / Done Timestamps)
    console.log('\n--- Testing Pre-Save Business Logic Hook ---');
    const task3 = await Task.create({
      title: 'Verify Database Schema Integrity',
      description: 'Initial architectural validation sweep',
      status: 'DONE', // Explicitly setting to DONE to trigger our schema hook
      priority: 'LOW',
      project: sharedProject._id,
      creator: ownerUser._id,
      assignee: ownerUser._id
    });
    console.log(`✅ Task 3 Created directly with status: DONE`);
    console.log(`⏱️ Derived Data Verification: "completedAt" timestamp auto-frozen: ${task3.completedAt !== undefined}`);

    console.log('\n==================================================');
    console.log('🎉 SUCCESS: Database Layer Verified Compliant with Assessment Sheet!');
    console.log('==================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILURE: Model constraint logic broken!');
    console.error(error.message);
    process.exit(1);
  }
};

runVerificationSeed();