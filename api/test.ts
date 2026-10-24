export default async function handler(req: any, res: any) {
  let sqliteSupported = false;
  let sqliteError = null;
  try {
    const sqlite = await import('node:sqlite');
    sqliteSupported = !!sqlite.DatabaseSync;
  } catch (err: any) {
    sqliteError = err.message;
  }

  res.status(200).json({
    nodeVersion: process.version,
    sqliteSupported,
    sqliteError,
    platform: process.platform,
    arch: process.arch
  });
}
