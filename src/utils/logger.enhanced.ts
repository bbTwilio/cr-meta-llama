import winston from 'winston';
import chalk from 'chalk';
import { config } from '../config';

// Icons for different log types
const ICONS = {
  // Status icons
  info: '💬',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍',

  // Service icons
  twilio: '📞',
  llama: '🤖',
  websocket: '🔌',
  session: '🔐',
  server: '🚀',
  http: '🌐',

  // Event icons
  incoming: '📥',
  outgoing: '📤',
  connect: '🔗',
  disconnect: '🔌',
  voice: '🎤',
  dtmf: '📱',
  performance: '⚡',
  database: '💾',

  // State icons
  start: '▶️',
  stop: '⏹️',
  pause: '⏸️',
  processing: '⏳',
  complete: '✔️',
  failed: '✖️',
};

// Color themes for different log contexts
const COLORS = {
  timestamp: chalk.gray,

  // Log levels
  error: chalk.red.bold,
  warn: chalk.yellow,
  info: chalk.cyan,
  debug: chalk.gray,

  // Services
  twilio: chalk.magenta,
  llama: chalk.green,
  websocket: chalk.blue,
  session: chalk.yellow,
  server: chalk.cyan.bold,

  // Data types
  key: chalk.white.dim,
  value: chalk.white,
  number: chalk.yellow,
  string: chalk.green,
  boolean: chalk.blue,
  null: chalk.gray,

  // Status
  success: chalk.green.bold,
  pending: chalk.yellow,
  failed: chalk.red,
};

// Format metadata with colors and indentation
const formatMetadata = (meta: any, indent: string = ''): string => {
  if (meta === null || meta === undefined) {
    return COLORS.null('null');
  }

  if (typeof meta === 'string') {
    // Truncate long strings
    const str = meta.length > 100 ? meta.substring(0, 97) + '...' : meta;
    return COLORS.string(`"${str}"`);
  }

  if (typeof meta === 'number') {
    return COLORS.number(meta.toString());
  }

  if (typeof meta === 'boolean') {
    return COLORS.boolean(meta.toString());
  }

  if (Array.isArray(meta)) {
    if (meta.length === 0) return '[]';
    const items = meta.slice(0, 3).map(item => formatMetadata(item, indent + '  '));
    if (meta.length > 3) items.push(COLORS.key('...'));
    return `[${items.join(', ')}]`;
  }

  if (typeof meta === 'object') {
    const keys = Object.keys(meta);
    if (keys.length === 0) return '{}';

    // For simple objects, inline format
    if (keys.length <= 3 && !keys.some(k => typeof meta[k] === 'object')) {
      const pairs = keys.map(k =>
        `${COLORS.key(k)}: ${formatMetadata(meta[k], indent)}`
      );
      return `{ ${pairs.join(', ')} }`;
    }

    // For complex objects, multi-line format
    const pairs = keys.slice(0, 5).map(k =>
      `${indent}  ${COLORS.key(k)}: ${formatMetadata(meta[k], indent + '  ')}`
    );
    if (keys.length > 5) pairs.push(`${indent}  ${COLORS.key('...')}`);
    return `{\n${pairs.join(',\n')}\n${indent}}`;
  }

  return String(meta);
};

// Custom format for pretty console output
const prettyFormat = winston.format.printf(({ timestamp, level, message, ...meta }: any) => {
  // Format timestamp
  const time = COLORS.timestamp(new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + new Date(timestamp).getMilliseconds().toString().padStart(3, '0'));

  // Get appropriate icon and color for level
  let icon = ICONS.info;
  let levelColor = COLORS.info;
  let levelText = level.toUpperCase().padEnd(5);

  switch (level) {
    case 'error':
      icon = ICONS.error;
      levelColor = COLORS.error;
      break;
    case 'warn':
      icon = ICONS.warning;
      levelColor = COLORS.warn;
      break;
    case 'info':
      icon = ICONS.info;
      levelColor = COLORS.info;
      break;
    case 'debug':
      icon = ICONS.debug;
      levelColor = COLORS.debug;
      break;
  }

  // Check for service-specific icons
  const msgStr = String(message);
  if (msgStr.includes('Twilio')) icon = ICONS.twilio;
  else if (msgStr.includes('Llama')) icon = ICONS.llama;
  else if (msgStr.includes('WebSocket')) icon = ICONS.websocket;
  else if (msgStr.includes('Session')) icon = ICONS.session;
  else if (msgStr.includes('Server')) icon = ICONS.server;
  else if (msgStr.includes('Incoming')) icon = ICONS.incoming;
  else if (msgStr.includes('Performance')) icon = ICONS.performance;

  // Format the main message
  let formattedMessage = msgStr;

  // Highlight important parts of the message
  formattedMessage = formattedMessage
    .replace(/(\d+)ms/g, COLORS.number('$1ms'))
    .replace(/(\d+)/g, COLORS.number('$1'))
    .replace(/(error|failed|failure)/gi, COLORS.failed('$1'))
    .replace(/(success|successful|completed)/gi, COLORS.success('$1'))
    .replace(/(pending|processing|waiting)/gi, COLORS.pending('$1'));

  // Build the log line
  let logLine = `${time} ${icon}  ${levelColor(levelText)} ${chalk.white.bold(formattedMessage)}`;

  // Add formatted metadata if present
  if (Object.keys(meta).length > 0) {
    // Special formatting for specific metadata fields
    const formattedMeta: any = {};

    for (const [key, value] of Object.entries(meta)) {
      // Skip certain verbose fields in non-debug mode
      if (config.logging.level !== 'debug' &&
          ['stack', 'fullMessage', 'twiml'].includes(key)) {
        continue;
      }

      // Special formatting for specific fields
      if (key === 'duration' && typeof value === 'number') {
        formattedMeta[key] = COLORS.number(`${value}ms`);
      } else if (key === 'sessionId' || key === 'callSid') {
        formattedMeta[key] = COLORS.session(value as string);
      } else if (key === 'from' || key === 'to') {
        formattedMeta[key] = COLORS.twilio(value as string);
      } else if (key === 'responseType' || key === 'messageType') {
        formattedMeta[key] = chalk.magenta(value as string);
      } else {
        formattedMeta[key] = value;
      }
    }

    if (Object.keys(formattedMeta).length > 0) {
      const metaStr = formatMetadata(formattedMeta, '');
      logLine += `\n  ${COLORS.key('└─')} ${metaStr}`;
    }
  }

  return logLine;
});

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create enhanced logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? jsonFormat : winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    prettyFormat
  ),
  transports: [
    new winston.transports.Console({
      format: config.logging.format === 'json' ? jsonFormat : prettyFormat,
    }),
  ],
});

// Add file transport in production
if (config.server.nodeEnv === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat, // Always use JSON in files
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat, // Always use JSON in files
    })
  );
}

// Enhanced logging functions with icons
export const logWebSocket = (event: string, data?: any) => {
  const icon = event.includes('connect') ? ICONS.connect :
               event.includes('disconnect') ? ICONS.disconnect :
               event.includes('message:sent') ? ICONS.outgoing :
               event.includes('message:received') ? ICONS.incoming :
               ICONS.websocket;

  const level = ['message:sent', 'message:received', 'error'].some(e => event.includes(e))
    ? 'info' : 'debug';

  logger.log(level, `${icon} WebSocket Event`, { event, ...data });
};

export const logTwilio = (event: string, data?: any) => {
  const icon = event.includes('incoming') ? ICONS.incoming :
               event.includes('voice') ? ICONS.voice :
               event.includes('dtmf') ? ICONS.dtmf :
               ICONS.twilio;

  logger.info(`${icon} Twilio Event`, { event, ...data });
};

export const logLlama = (event: string, data?: any) => {
  const icon = event === 'request' ? ICONS.outgoing :
               event === 'response' ? ICONS.incoming :
               event === 'error' ? ICONS.error :
               ICONS.llama;

  logger.info(`${icon} Llama API`, { event, ...data });
};

export const logSession = (event: string, sessionId: string, data?: any) => {
  const icon = event.includes('created') ? ICONS.start :
               event.includes('ended') ? ICONS.stop :
               event.includes('updated') ? ICONS.processing :
               ICONS.session;

  logger.debug(`${icon} Session Event`, { event, sessionId, ...data });
};

export const logError = (error: Error, context?: string) => {
  logger.error(`${ICONS.error} ${context || 'Error occurred'}`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  const icon = duration < 100 ? '⚡' : duration < 500 ? '🔸' : '🔶';
  const durationColor = duration < 100 ? COLORS.success :
                       duration < 500 ? COLORS.pending :
                       COLORS.failed;

  logger.info(`${icon} Performance`, {
    operation,
    duration: durationColor(`${duration}ms`),
    ...metadata,
  });
};

// Startup banner
export const logStartupBanner = () => {
  const banner = chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${chalk.white.bold('🤖 CR-META-LLAMA')}  ${chalk.gray('v1.0.0')}                                ║
║   ${chalk.green('Twilio ConversationRelay + Meta Llama Integration')}        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  console.log(banner);
};

// Status indicators
export const logStatus = {
  starting: (service: string) =>
    logger.info(`${ICONS.start} Starting ${chalk.bold(service)}...`),

  ready: (service: string, details?: any) =>
    logger.info(`${ICONS.success} ${chalk.bold(service)} ready`, details),

  stopping: (service: string) =>
    logger.info(`${ICONS.stop} Stopping ${chalk.bold(service)}...`),

  stopped: (service: string) =>
    logger.info(`${ICONS.complete} ${chalk.bold(service)} stopped`),

  failed: (service: string, error: any) =>
    logger.error(`${ICONS.failed} ${chalk.bold(service)} failed`, { error }),
};

export default logger;