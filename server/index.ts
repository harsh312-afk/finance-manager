import app from './app.ts';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 VaultFlow Finance API server listening on http://localhost:${PORT}`);
});
