export default async function handler(req: any, res: any) {
  let appLoaded = false;
  let appError = null;
  try {
    const appModule = await import('../server/app.ts');
    appLoaded = !!appModule.default;
  } catch (err: any) {
    appError = { message: err?.message, stack: err?.stack };
  }

  res.status(200).json({
    appLoaded,
    appError,
    nodeVersion: process.version
  });
}
