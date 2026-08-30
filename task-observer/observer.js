const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TaskObserver {
  constructor(dataPath = '.task-observer') {
    this.dataPath = dataPath;
    this.tasksFile = path.join(dataPath, 'tasks.json');
    this.metricsFile = path.join(dataPath, 'metrics.json');
    this.improvementsFile = path.join(dataPath, 'improvements.json');
    this.skillsFile = path.join(dataPath, 'skills.json');
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

    // Métriques de cette exécution
    if (!success) task.metrics.failures++;
    task.metrics.avgDuration = duration;
    task.metrics.successRate = (task.metrics.attempts - task.metrics.failures) / task.metrics.attempts;

    // Stocker les données supplémentaires
    if (Object.keys(data).length > 0) {
      task.data = data;
    }

    // Les métriques qui comptent sont cumulées sur l'identité de la tâche,
    // pas sur cette exécution : c'est ce cumul qui déclenche les suggestions.
    task.skill = this.skillKey(task);
    const aggregate = this.updateAggregate(task, success, duration);
    task.aggregate = aggregate;

    this.saveTasks(tasks);
    this.recordMetric(taskId, task);
    this.analyzeAndImprove(task, aggregate);

    return task;
  }

  skillKey(task) {
    return `${task.category}::${task.name}`;
  }

  updateAggregate(task, success, duration) {
    const skills = this.loadSkills();
    const key = this.skillKey(task);

    const agg = skills[key] || {
      key,
      name: task.name,
      category: task.category,
      runs: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      avgDuration: 0,
      successRate: 0,
      firstRun: new Date().toISOString(),
      lastRun: null
    };

    agg.runs++;
    if (success) {
      agg.successes++;
      agg.totalDuration += duration;
      agg.avgDuration = agg.totalDuration / agg.successes;
    } else {
      agg.failures++;
    }
    agg.successRate = agg.successes / agg.runs;
    agg.lastRun = new Date().toISOString();

    skills[key] = agg;
    this.saveSkills(skills);
    return agg;
  }

  recordMetric(taskId, task) {
    // L'historique est indexé sur l'identité de la tâche : c'est lui qui
    // permet de lire une tendance sur plusieurs exécutions.
    const key = task.skill || this.skillKey(task);
    const metrics = this.loadMetrics();
    if (!metrics[key]) {
      metrics[key] = [];
    }

    metrics[key].push({
      taskId,
      timestamp: new Date().toISOString(),
      duration: task.duration,
      success: task.status === 'completed'
    });

    // Garder seulement les 100 dernières métriques
    if (metrics[key].length > 100) {
      metrics[key] = metrics[key].slice(-100);
    }

    this.saveMetrics(metrics);
  }

  analyzeAndImprove(task, aggregate) {
    const key = aggregate.key;
    const improvements = this.loadImprovements();
    if (!improvements[key]) {
      improvements[key] = [];
    }

    // Analyse automatique des améliorations
    const suggestions = this.generateSuggestions(task, aggregate);

    suggestions.forEach(suggestion => {
      // Une suggestion encore ouverte du même type ne se répète pas à chaque
      // exécution : on rafraîchit ses chiffres au lieu d'en empiler une copie.
      const open = improvements[key].find(
        i => i.type === suggestion.type && i.status === 'pending'
      );

      if (open) {
        open.description = suggestion.description;
        open.suggestedAction = suggestion.action;
        open.impact = suggestion.impact;
        open.timestamp = new Date().toISOString();
        open.occurrences = (open.occurrences || 1) + 1;
        return;
      }

      improvements[key].push({
        id: crypto.randomBytes(8).toString('hex'),
        skill: key,
        timestamp: new Date().toISOString(),
        type: suggestion.type,
        description: suggestion.description,
        suggestedAction: suggestion.action,
        status: 'pending',
        implemented: false,
        occurrences: 1,
        impact: suggestion.impact
      });
    });

    this.saveImprovements(improvements);
  }

  generateSuggestions(task, agg) {
    const suggestions = [];

    // En dessous de 3 exécutions, les chiffres ne disent rien d'exploitable.
    if (agg.runs < 3) return suggestions;

    // Suggestion basée sur le taux de succès cumulé
    if (agg.successRate < 0.8) {
      suggestions.push({
        type: 'reliability',
        description: `Taux de succès de ${(agg.successRate * 100).toFixed(0)}% sur ${agg.runs} exécutions (${agg.failures} échecs)`,
        action: 'Revoir la gestion des erreurs et valider les entrées',
        impact: agg.successRate < 0.5 ? 'high' : 'medium'
      });
    }

    // Suggestion basée sur la durée moyenne des exécutions réussies
    if (agg.successes > 0 && agg.avgDuration > 5000) {
      suggestions.push({
        type: 'performance',
        description: `Durée moyenne de ${(agg.avgDuration / 1000).toFixed(1)}s sur ${agg.successes} exécutions réussies`,
        action: 'Optimiser l\'exécution ou mettre en cache les résultats',
        impact: agg.avgDuration > 15000 ? 'high' : 'medium'
      });
    }

    // Suggestion basée sur la répétition d'échecs
    if (agg.failures >= 3 && agg.successRate > 0) {
      suggestions.push({
        type: 'retry_strategy',
        description: `${agg.failures} échecs pour ${agg.successes} succès : la tâche est instable`,
        action: 'Ajouter un retry avec backoff exponentiel',
        impact: 'high'
      });
    }

    return suggestions;
  }

  getTaskStats(taskId) {
    const tasks = this.loadTasks();
    const task = tasks[taskId];
    if (!task) return null;

    const key = task.skill || this.skillKey(task);
    const history = this.loadMetrics()[key] || [];
    const agg = this.loadSkills()[key];

    return {
      task,
      metrics: {
        total: history.length,
        runs: agg ? agg.runs : 0,
        avgDuration: agg ? agg.avgDuration : 0,
        successRate: agg ? agg.successRate : 0,
        failures: agg ? agg.failures : 0,
        successCount: agg ? agg.successes : 0
      },
      trend: this.calculateTrend(history)
    };
  }

  getSkillStats(name, category = 'general') {
    return this.loadSkills()[`${category}::${name}`] || null;
  }

  getAllSkills() {
    return this.loadSkills();
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

  // Accepte un id de tâche ou directement une clé de skill ("categorie::nom").
  resolveKey(taskIdOrKey) {
    if (taskIdOrKey.includes('::')) return taskIdOrKey;
    const task = this.loadTasks()[taskIdOrKey];
    if (!task) return taskIdOrKey;
    return task.skill || this.skillKey(task);
  }

  getImprovements(taskIdOrKey) {
    const improvements = this.loadImprovements();
    return improvements[this.resolveKey(taskIdOrKey)] || [];
  }

  implementImprovement(taskIdOrKey, improvementId) {
    const improvements = this.loadImprovements();
    const key = this.resolveKey(taskIdOrKey);

    if (!improvements[key]) return null;

    const improvement = improvements[key].find(i => i.id === improvementId);
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

  loadSkills() {
    if (!fs.existsSync(this.skillsFile)) return {};
    const content = fs.readFileSync(this.skillsFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  saveSkills(skills) {
    fs.writeFileSync(this.skillsFile, JSON.stringify(skills, null, 2));
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
