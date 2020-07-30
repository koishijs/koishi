export const errors = {
  DUPLICATE_COMMAND: 'duplicate command names: "%s"',
  DUPLICATE_OPTION: 'duplicate option names: "%s"',
  EXPECT_COMMAND_NAME: 'expect a command name',
  INVALID_PLUGIN: 'invalid plugin, expect function or object with an "apply" method',
  INVALID_CONTEXT: 'invalid context path',
  INVALID_IDENTIFIER: 'invalid context identifier',
  INVALID_SUBCOMMAND: 'invalid subcommand',
  MISSING_CONFIGURATION: 'missing configuration "%s"',
  MAX_MIDDLEWARES: 'max middleware count (%d) exceeded, which may be caused by a memory leak',
  MULTIPLE_ANONYMOUS_BOTS: 'your cqhttp version does not support multiple anonymous bots, please upgrade your cqhttp to 3.4 or above',
} as const
