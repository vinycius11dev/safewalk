// Passenger/DirectAdmin startup entry. Run the TypeScript build before deployment.
import('./dist/server.js').catch(() => {
  console.error('Não foi possível iniciar a API. Confira o ambiente e a conexão com o banco.');
  process.exitCode = 1;
});
