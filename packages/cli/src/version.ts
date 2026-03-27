declare const __MINDPASS_VERSION__: string | undefined;

export const CLI_VERSION =
  typeof __MINDPASS_VERSION__ !== 'undefined'
    ? __MINDPASS_VERSION__
    : process.env['MINDPASS_VERSION'] ?? '0.0.0-dev';
