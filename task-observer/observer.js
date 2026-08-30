const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TaskObserver {
  constructor(dataPath = '.task-observer') {
    this.dataPath = dataPath;
    this.tasksFile = path.join(dataPath, 'tasks.json');
    this.metricsFile = path.join(dataPath, 'metrics.json');
    this.improvementsFile = path.join(dataPath, 'improvements.json');
    this.ensureStorage();
  }

  ensureStorage() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  createTask(name, description, category = 'general', priority = 'medium') {
    const tasks = this.loadTasks();
    const id = crypto.randomBytes(8).toString('hex');

    const task = {
      id,
      name,
      description,
      category,
      priority,
      status: 'created',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      duration: null,
      metrics: {
        attempts: 0,
        successRate: 0,
        avgDuration: 0,
        failures: 0
      },
      improvements: []
    };

    tasks[id] = task;
    this.saveTasks(tasks);
    return task;
  }

  startTask(taskId) {
    const tasks = this.loadTasks();
    if (!tasks[taskId]) throw new Error(`Task ${taskId} not found`);

    tasks[taskId].status = 'in_progress';
    tasks[taskId].startedAt = new Date().toISOString();
    tasks[taskId].metrics.attempts++;

    this.saveTasks(tasks);
    return tasks[taskId];
  }

  completeTask(taskId, success = true, data = {}) {
    const tasks = this.loadTasks();
    if (!tasks[taskId]) throw new Error(`Task ${taskId} not found`);

    const task = tasks[taskId];
    const completedAt = new Date().toISOString();
    const duration = task.startedAt
      ? new Date(completedAt) - new Date(task.startedAt)
      : 0;

    task.status = success ? 'completed' : 'failed';
    task.completedAt = completedAt;
    task.duration = duration;

    // Mettre à jour les métriques
    if (success) {
      const prevAvg = task.metrics.avgDuration;
      const newCount = task.metrics.attempts;
      task.metrics.avgDuration = (prevAvg * (newCount - 1) + duration) / newCount;
      task.metrics.successRate = (task.metrics.attempts - task.metrics.failures) / task.metrics.attempts;
    } else {
      task.metrics.failures++;
      task.metrics.successRate = (task.metrics.attempts - task.metrics.failures) / task.metrics.attempts;
    }

    // Stocker les données supplémentaires
    if (Object.keys(data).length > 0) {
      task.data = data;
    }

    this.saveTasks(tasks);
    this.recordMetric(taskId, task);
    this.analyzeAndImprove(taskId, task);

    return task;
  }

  recordMetric(taskId, task) {
    const metrics = this.loadMetrics();
    if (!metrics[taskId]) {
      metrics[taskId] = [];
    }

    metrics[taskId].push({
      timestamp: new Date().toISOString(),
      duration: task.duration,
      success: task.status === 'completed',
      attempts: task.metrics.attempts,
      successRate: task.metrics.successRate
    });

    // Garder seulement les 100 dernières métriques
    if (metrics[taskId].length > 100) {
      metrics[taskId] = metrics[taskId].slice(-100);
    }

    this.saveMetrics(metrics);
  }

  analyzeAndImprove(taskId, task) {
    const improvements = this.loadImprovements();
    if (!improvements[taskId]) {
      improvements[taskId] = [];
    }

    // Analyse automatique des améliorations
    const suggestions = this.generateSuggestions(taskId, task);

    suggestions.forEach(suggestion => {
      improvements[taskId].push({
        id: crypto.randomBytes(8).toString('hex'),
        timestamp: new Date().toISOString(),
        type: suggestion.type,
        description: suggestion.description,
        suggestedAction: suggestion.action,
        status: 'pending',
        implemented: false,
        impact: suggestion.impact
      });
    });

    this.saveImprovements(improvements);
  }

  generateSuggestions(taskId, task) {
    const suggestions = [];

    // Suggestion basée sur le taux de succès
    if (task.metrics.successRate < 0.8 && task.metrics.attempts > 3) {
      suggestions.push({
        type: 'reliability',
        description: `Success rate is ${(task.metrics.successRate * 100).toFixed(1)}%`,
        action: 'Review error handling and add validation',
        impact: 'high'
      });
    }

    // Suggestion basée sur la durée
    if (task.metrics.avgDuration > 5000) {
      suggestions.push({
        type: 'performance',
        description: `Average duration is ${task.metrics.avgDuration.toFixed(0)}ms`,
        action: 'Optimize task execution or add caching',
        impact: 'medium'
      });
    }

    // Suggestion basée sur les tentatives
    if (task.metrics.attempts > 5 && task.metrics.successRate < 1) {
      suggestions.push({
        type: 'retry_strategy',
        description: `Task requires multiple attempts`,
        action: 'Implement exponential backoff or improve initial logic',
        impact: 'high'
      });
    }

    return suggestions;
  }

  getTaskStats(taskId) {
    const tasks = this.loadTasks();
    const task = tasks[taskId];
    const metrics = this.loadMetrics()[taskId] || [];

    if (!task) return null;

    return {
      task,
      metrics: {
        total: metrics.length,
        avgDuration: task.metrics.avgDuration,
        successRate: task.metrics.successRate,
        failures: task.metrics.failures,
        successCount: task.metrics.attempts - task.metrics.failures
      },
      trend: this.calculateTrend(metrics)
    };
  }

  calculateTrend(metrics) {
    if (metrics.length < 2) return 'stable';

    const recent = metrics.slice(-5);
    const older = metrics.slice(-10, -5);

    const recentSuccessRate = recent.filter(m => m.success).length / recent.length;
    const olderSuccessRate = older.length > 0
      ? older.filter(m => m.success).length / older.length
      : recentSuccessRate;

    if (recentSuccessRate > olderSuccessRate) return 'improving';
    if (recentSuccessRate < olderSuccessRate) return 'declining';
    return 'stable';
  }

  getImprovements(taskId) {
    const improvements = this.loadImprovements();
    return improvements[taskId] || [];
  }

  implementImprovement(taskId, improvementId) {
    const improvements = this.loadImprovements();

    if (!improvements[taskId]) return null;

    const improvement = improvements[taskId].find(i => i.id === improvementId);
    if (!improvement) return null;

    improvement.implemented = true;
    improvement.status = 'implemented';
    improvement.implementedAt = new Date().toISOString();

    this.saveImprovements(improvements);
    return improvement;
  }

  getAllTasks() {
    return this.loadTasks();
  }

  getTasksByCategory(category) {
    const tasks = this.loadTasks();
    return Object.values(tasks).filter(t => t.category === category);
  }

  getTasksByPriority(priority) {
    const tasks = this.loadTasks();
    return Object.values(tasks).filter(t => t.priority === priority);
  }

  loadTasks() {
    if (!fs.existsSync(this.tasksFile)) return {};
    const content = fs.readFileSync(this.tasksFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  saveTasks(tasks) {
    fs.writeFileSync(this.tasksFile, JSON.stringify(tasks, null, 2));
  }

  loadMetrics() {
    if (!fs.existsSync(this.metricsFile)) return {};
    const content = fs.readFileSync(this.metricsFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  saveMetrics(metrics) {
    fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
  }

  loadImprovements() {
    if (!fs.existsSync(this.improvementsFile)) return {};
    const content = fs.readFileSync(this.improvementsFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  saveImprovements(improvements) {
    fs.writeFileSync(this.improvementsFile, JSON.stringify(improvements, null, 2));
  }

  generateReport() {
    const tasks = this.loadTasks();
    const improvements = this.loadImprovements();

    return {
      timestamp: new Date().toISOString(),
      taskSummary: {
        total: Object.keys(tasks).length,
        completed: Object.values(tasks).filter(t => t.status === 'completed').length,
        inProgress: Object.values(tasks).filter(t => t.status === 'in_progress').length,
        failed: Object.values(tasks).filter(t => t.status === 'failed').length
      },
      improvementSummary: {
        total: Object.values(improvements).reduce((sum, arr) => sum + arr.length, 0),
        pending: Object.values(improvements).reduce((sum, arr) =>
          sum + arr.filter(i => i.status === 'pending').length, 0),
        implemented: Object.values(improvements).reduce((sum, arr) =>
          sum + arr.filter(i => i.status === 'implemented').length, 0)
      },
      topImprovements: this.getTopImprovements(improvements)
    };
  }

  getTopImprovements(improvements) {
    return Object.values(improvements)
      .flat()
      .filter(i => i.status === 'pending')
      .sort((a, b) => {
        const impactScore = { high: 3, medium: 2, low: 1 };
        return (impactScore[b.impact] || 0) - (impactScore[a.impact] || 0);
      })
      .slice(0, 5);
  }
}

module.exports = TaskObserver;
