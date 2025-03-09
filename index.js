// If you're using Node >= 16, you can import from 'readline' like this:
import { cursorTo, clearLine } from 'readline';

/**
 * 1. Event Class
 */
class Event {
  constructor(id, priority, timestamp) {
    this.id = id;
    this.priority = priority;   // "LOW", "MEDIUM", or "HIGH"
    this.timestamp = timestamp; // when it was created
  }
}

/**
 * 2. EventQueue Class
 */
class EventQueue {
  constructor() {
    this.queue = [];
    this.isBusy = false;
  }

  async saveEvent(event) {
    while (this.isBusy) {
      await this.delay(100);
    }
    this.isBusy = true;
    await this.delay(3000); // simulate 3s save
    this.queue.push(event);
    this.isBusy = false;
  }

  async readEvent() {
    while (this.isBusy) {
      await this.delay(100);
    }
    this.isBusy = true;
    if (this.queue.length === 0) {
      this.isBusy = false;
      return null;
    }
    await this.delay(5000); // simulate 5s read
    const event = this.queue.shift();
    this.isBusy = false;
    return event;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 3. EventProducer Class
 */
class EventProducer {
  constructor(eventQueue, maxEvents = 400) {
    this.eventQueue = eventQueue;
    this.maxEvents = maxEvents;
    this.eventsProduced = 0;
    this.intervalId = null;
  }

  start(log) {
    const produceDelay = 3000; // produce every 3s
    this.intervalId = setInterval(async () => {
      if (this.eventsProduced >= this.maxEvents) {
        log(`EventProducer: Reached maximum events. Stopping producer...`);
        this.stop(log);
        return;
      }

      const priority = this.getRandomPriority();
      const event = new Event(this.eventsProduced + 1, priority, new Date());

      log(`EventProducer: Saving Event #${event.id} [${event.priority}]`);
      await this.eventQueue.saveEvent(event);
      this.eventsProduced++;
    }, produceDelay);
  }

  stop(log) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log(`EventProducer: Stopped producing events.`);
    }
  }

  getRandomPriority() {
    const r = Math.random();
    if (r < 0.33) return "LOW";
    if (r < 0.66) return "MEDIUM";
    return "HIGH";
  }
}

/**
 * 4. EventConsumer Class
 */
class EventConsumer {
  constructor(eventQueue, totalEvents = 400) {
    this.eventQueue = eventQueue;
    this.intervalId = null;
    this.lastPriority = null;
    this.alertCount = 0;
    this.eventsConsumed = 0;
    this.totalEvents = totalEvents;
  }

  start(log) {
    const consumeDelay = 5000; // consume every 5s
    this.intervalId = setInterval(async () => {
      const event = await this.eventQueue.readEvent();
      if (!event) return; // queue empty

      this.eventsConsumed++;
      log(`EventConsumer: Consumed Event #${event.id} [${event.priority}]`);

      if (this.lastPriority === event.priority) {
        this.alertCount++;
        log(`EventConsumer: ALERT! Two consecutive events [${event.priority}]`);
      }
      this.lastPriority = event.priority;
    }, consumeDelay);
  }

  stop(log) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log(`EventConsumer: Stopped consuming. Total alerts: ${this.alertCount}`);
    }
  }
}

/**
 * 5. Utilities: Progress Bar + Timer
 */
function renderProgressBar(current, total, barLength = 20) {
  if (total <= 0) return "[--------------------] 0.00%";
  const fraction = Math.min(current / total, 1);
  const filled = Math.round(fraction * barLength);
  const empty = barLength - filled;
  const bar = "█".repeat(filled) + "-".repeat(empty);
  const percentage = (fraction * 100).toFixed(2);
  return `[${bar}] ${percentage}%`;
}

function formatElapsedTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * 6. Main Simulation with In-Place (Pinned) Bars (ES Module version)
 */
async function main() {
  const eventQueue = new EventQueue();
  const producer = new EventProducer(eventQueue, 400);
  const consumer = new EventConsumer(eventQueue, 400);

  // We'll track how many log lines we've printed so far
  let logLineCount = 0;

  // Start time
  const startTime = Date.now();

  // We reserve lines 0..3 for pinned content
  //   0 -> Elapsed time
  //   1 -> Producer progress
  //   2 -> Consumer progress
  //   3 -> Separator
  // logs start at line 4

  // Helper to write pinned text at a specific line (0-based)
  function writePinnedLine(lineIndex, text) {
    cursorTo(process.stdout, 0, lineIndex);
    clearLine(process.stdout, 0);
    process.stdout.write(text);
  }

  // Update pinned bars
  function updatePinnedBars() {
    const elapsedMs = Date.now() - startTime;
    const producerBar = renderProgressBar(producer.eventsProduced, producer.maxEvents);
    const consumerBar = renderProgressBar(consumer.eventsConsumed, consumer.totalEvents);

    writePinnedLine(0, `Elapsed: ${formatElapsedTime(elapsedMs)}\n`);
    writePinnedLine(1, `Producer: ${producerBar} (${producer.eventsProduced}/${producer.maxEvents})\n`);
    writePinnedLine(2, `Consumer: ${consumerBar} (${consumer.eventsConsumed}/${consumer.totalEvents})\n`);
    writePinnedLine(3, "------------------------------------------------\n");
  }

  // Custom logger: prints below the pinned region
  function log(message) {
    cursorTo(process.stdout, 0, 4 + logLineCount);
    clearLine(process.stdout, 0);
    process.stdout.write(message + "\n");

    logLineCount++;
    // Refresh pinned bars to keep them up to date
    updatePinnedBars();
  }

  // Initialize pinned bars at 0% (before anything starts)
  for (let i = 0; i < 4; i++) {
    writePinnedLine(i, "\n"); // blank lines
  }
  updatePinnedBars();

  // Start producer & consumer
  producer.start(log);
  consumer.start(log);

  // Also update pinned bars every second for elapsed time
  const uiInterval = setInterval(updatePinnedBars, 1000);

  // Stop producer after 20 minutes
  setTimeout(() => {
    producer.stop(log);
  }, 20 * 60 * 1000);

  // Stop consumer after 50 minutes
  setTimeout(() => {
    consumer.stop(log);
    clearInterval(uiInterval);
    updatePinnedBars(); // final update

    // Print summary below pinned region + logs
    const summaryLine = 4 + logLineCount; // the next free line
    cursorTo(process.stdout, 0, summaryLine);
    process.stdout.write(`Total events consumed: ${consumer.eventsConsumed}\n`);
    process.stdout.write(`Total alerts generated: ${consumer.alertCount}\n`);
    process.stdout.write("Simulation complete.\n");

    process.exit(0);
  }, 50 * 60 * 1000);
}

// Run
main();
