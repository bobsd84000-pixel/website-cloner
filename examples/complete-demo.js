const path = require('path');
const ClaudeToolkit = require('../index');

async function runCompleteDemo() {
  console.log('═══════════════════════════════════════════');
  console.log('   CLAUDE TOOLKIT - COMPLETE DEMO');
  console.log('═══════════════════════════════════════════\n');

  // La racine du projet, pas le dossier examples/ : le setup y trouve package.json.
  const toolkit = new ClaudeToolkit(path.join(__dirname, '..'));

  // 1. Initialize
  console.log('1️⃣  INITIALIZING TOOLKIT\n');
  const init = await toolkit.initialize();
  console.log('Status:', init);
  console.log();

  // 2. Demo Claude-mem
  console.log('2️⃣  CLAUDE-MEM: PERSISTENT MEMORY\n');
  toolkit.saveMemory('project:name', 'My Awesome Project', { type: 'metadata' });
  toolkit.saveMemory('project:version', '1.0.0', { type: 'version' });
  toolkit.saveMemory('api:endpoint', 'https://api.example.com', { type: 'config' });

  const memory = toolkit.getMemory('project:name');
  console.log('Retrieved memory:', memory);

  const search = toolkit.searchMemory('project');
  console.log('Search results for "project":', search.length, 'entries found\n');

  const memStats = toolkit.memoryStats();
  console.log('Memory stats:', memStats);
  console.log();

  // 3. Demo Claude Code Setup
  console.log('3️⃣  CLAUDE CODE SETUP: PROJECT CONFIGURATION\n');
  const status = toolkit.getProjectStatus();
  console.log('Project status:');
  console.log('- Name:', status.settings.project.name);
  console.log('- Language:', status.settings.project.language);
  console.log('- Hooks installed:', status.hooksInstalled);
  console.log('- Skills setup:', status.skillsSetup);
  console.log();

  // 4. Demo Task Observer
  console.log('4️⃣  TASK OBSERVER: AUTOMATIC IMPROVEMENT\n');

  // Create and track tasks
  const task1 = toolkit.createTask('Data Processing', 'Process input data', 'processing');
  console.log('Created task:', task1.name);

  toolkit.startTask(task1.id);
  await new Promise(resolve => setTimeout(resolve, 1000));
  toolkit.completeTask(task1.id, true, { itemsProcessed: 150 });

  const task2 = toolkit.createTask('Validation', 'Validate output', 'validation');
  toolkit.startTask(task2.id);
  await new Promise(resolve => setTimeout(resolve, 500));
  toolkit.completeTask(task2.id, true, { itemsValidated: 150 });

  // Même tâche relancée plusieurs fois : c'est ce cumul que l'observer lit.
  // Le motif d'échecs est fixe pour que la démo donne le même résultat à chaque run.
  const outcomes = [true, false, true, false, false, true];
  let lastBatchId = null;

  for (const success of outcomes) {
    const task = toolkit.createTask('Batch Processing', 'Process batch', 'processing');
    toolkit.startTask(task.id);
    await new Promise(resolve => setTimeout(resolve, 120));
    toolkit.completeTask(task.id, success, { items: 100 });
    lastBatchId = task.id;
  }

  const batch = toolkit.observer.getSkillStats('Batch Processing', 'processing');
  console.log(`"Batch Processing" cumulé sur ${batch.runs} exécutions :`);
  console.log(`- Succès: ${batch.successes} | Échecs: ${batch.failures}`);
  console.log(`- Taux de succès: ${(batch.successRate * 100).toFixed(0)}%`);
  console.log(`- Tendance: ${toolkit.getTaskStats(lastBatchId).trend}`);
  console.log();

  // 5. Display improvements
  console.log('5️⃣  AUTOMATIC IMPROVEMENTS DETECTED\n');
  const report = toolkit.getReport();
  console.log('Task Summary:');
  console.log('- Total tasks:', report.taskSummary.total);
  console.log('- Completed:', report.taskSummary.completed);
  console.log('- In Progress:', report.taskSummary.inProgress);
  console.log('- Failed:', report.taskSummary.failed);
  console.log();

  console.log('Improvement Summary:');
  console.log('- Total suggestions:', report.improvementSummary.total);
  console.log('- Pending:', report.improvementSummary.pending);
  console.log('- Implemented:', report.improvementSummary.implemented);
  console.log();

  if (report.topImprovements.length > 0) {
    console.log('Top Improvements:');
    report.topImprovements.slice(0, 3).forEach((imp, i) => {
      console.log(`  ${i + 1}. [${imp.type.toUpperCase()}] ${imp.description}`);
      console.log(`     → ${imp.suggestedAction}`);
    });
  }
  console.log();

  // 6. Full report
  console.log('6️⃣  COMPLETE TOOLKIT REPORT\n');
  const fullReport = toolkit.getFullReport();
  console.log(JSON.stringify(fullReport, null, 2));
}

runCompleteDemo().catch(console.error);
