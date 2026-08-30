const ClaudeMem = require('./claude-mem/memory');
const ClaudeCodeSetup = require('./claude-code-setup/setup');
const TaskObserver = require('./task-observer/observer');

class ClaudeToolkit {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.memory = new ClaudeMem();
    this.setup = new ClaudeCodeSetup(projectRoot);
    this.observer = new TaskObserver();
  }

  async initialize() {
    console.log('🚀 Initializing Claude Toolkit...');

    // Setup project configuration
    const setupStatus = this.setup.initialize();
    console.log('✓ Claude Code Setup initialized');

    // Initialize memory system
    console.log('✓ Claude-mem initialized');

    // Initialize task observer
    console.log('✓ Task Observer initialized');

    return {
      setup: setupStatus,
      memory: 'ready',
      observer: 'ready'
    };
  }

  // Memory API
  saveMemory(key, value, metadata) {
    return this.memory.save(key, value, metadata);
  }

  getMemory(key) {
    return this.memory.get(key);
  }

  searchMemory(pattern) {
    return this.memory.search(pattern);
  }

  memoryStats() {
    return this.memory.getStats();
  }

  // Setup API
  getProjectStatus() {
    return this.setup.getStatus();
  }

  optimizeProject() {
    return this.setup.optimize();
  }

  validateSetup() {
    return this.setup.validate();
  }

  // Task Observer API
  createTask(name, description, category, priority) {
    return this.observer.createTask(name, description, category, priority);
  }

  startTask(taskId) {
    return this.observer.startTask(taskId);
  }

  completeTask(taskId, success, data) {
    return this.observer.completeTask(taskId, success, data);
  }

  getTaskStats(taskId) {
    return this.observer.getTaskStats(taskId);
  }

  getImprovements(taskId) {
    return this.observer.getImprovements(taskId);
  }

  getReport() {
    return this.observer.generateReport();
  }

  // Combined operations
  async executeTaskWithTracking(taskName, executor) {
    const task = this.createTask(taskName, `Executing ${taskName}`, 'execution');
    this.startTask(task.id);

    try {
      const result = await executor();
      this.completeTask(task.id, true, { result });

      // Store result in memory
      this.saveMemory(`task:${task.id}:result`, result, {
        taskName,
        timestamp: new Date().toISOString()
      });

      return { success: true, taskId: task.id, result };
    } catch (error) {
      this.completeTask(task.id, false, { error: error.message });

      // Store error in memory
      this.saveMemory(`task:${task.id}:error`, error.message, {
        taskName,
        timestamp: new Date().toISOString()
      });

      return { success: false, taskId: task.id, error: error.message };
    }
  }

  getFullReport() {
    return {
      timestamp: new Date().toISOString(),
      project: this.getProjectStatus(),
      memory: this.memoryStats(),
      tasks: this.getReport(),
      validation: this.validateSetup()
    };
  }
}

module.exports = ClaudeToolkit;
