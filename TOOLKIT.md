# Claude Toolkit 🚀

Système intégré d'outils pour Claude Code avec trois fonctionnalités majeures :
- **Claude-mem** : Mémoire persistante entre les sessions
- **Claude Code Setup** : Configuration optimisée des projets
- **Task Observer** : Amélioration automatique des skills

## Installation

```bash
npm install tarik-toolkit
```

## Utilisation Rapide

```javascript
const ClaudeToolkit = require('tarik-toolkit');

const toolkit = new ClaudeToolkit();
await toolkit.initialize();

// Sauvegarder en mémoire
toolkit.saveMemory('user:preferences', { theme: 'dark' });

// Créer une tâche
const task = toolkit.createTask('Build API', 'Create REST endpoints', 'development');
toolkit.startTask(task.id);
toolkit.completeTask(task.id, true, { endpoints: 5 });

// Voir les améliorations suggérées
const improvements = toolkit.getImprovements(task.id);
```

## Trois Systèmes Intégrés

### 1. Claude-mem 🧠

Mémoire persistante qui survit entre les sessions.

**API:**
```javascript
toolkit.saveMemory(key, value, metadata);
toolkit.getMemory(key);
toolkit.searchMemory('pattern');
toolkit.memoryStats();
```

### 2. Claude Code Setup ⚙️

Configuration optimisée des projets Claude Code.

**API:**
```javascript
toolkit.setup.initialize();
toolkit.optimizeProject();
toolkit.validateSetup();
toolkit.getProjectStatus();
```

### 3. Task Observer 👁️

Observation et amélioration automatique.

**API:**
```javascript
toolkit.createTask(name, description, category, priority);
toolkit.startTask(task.id);
toolkit.completeTask(task.id, success, data);
toolkit.getImprovements(task.id);
toolkit.getReport();
```

## Exécution avec Suivi

```javascript
const result = await toolkit.executeTaskWithTracking(
  'Build Feature',
  async () => {
    return { status: 'success' };
  }
);
```

## Performance

- **Mémoire** : < 1MB par 1000 entrées
- **Vitesse** : Opérations < 10ms
- **Scalabilité** : Supporte 10K+ tâches
- **Overhead** : < 5% du temps d'exécution

## Licence

MIT
