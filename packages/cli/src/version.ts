declare const __MINDWALLET_VERSION__: string | undefined;

export const CLI_VERSION =
  typeof __MINDWALLET_VERSION__ !== 'undefined'
    ? __MINDWALLET_VERSION__
    : process.env['MINDWALLET_VERSION'] ?? '0.0.0-dev';
