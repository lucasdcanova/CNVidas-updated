// Este código previne que os erros do Vite interrompam o carregamento da aplicação
// Especialmente útil para evitar problemas de login relacionados a erros de carregamento

(function() {
  // Captura erros de runtime para evitar que bloqueiem o carregamento da aplicação
  window.addEventListener('error', function(event) {
    // Verificar se o erro é relacionado a um plugin do Vite ou outro erro não crítico
    if (event && event.error && (
      event.error.message.includes('Vite') || 
      event.error.message.includes('plugin') ||
      event.error.message.includes('React'))) {
      
      console.error('Erro capturado pelo handler global:', event.error);
      
      // Prevenir que o erro pare a execução da aplicação
      event.preventDefault();
      return true;
    }
  });

  // Backup para garantir que os erros de promise não interrompam a aplicação
  window.addEventListener('unhandledrejection', function(event) {
    // Verificar se o erro é relacionado a um plugin do Vite ou outro erro não crítico
    if (event && event.reason && (
      (event.reason.message && (
        event.reason.message.includes('Vite') || 
        event.reason.message.includes('plugin') || 
        event.reason.message.includes('React')
      )))) {
      
      console.error('Promise rejeitada capturada pelo handler global:', event.reason);
      
      // Prevenir que o erro pare a execução da aplicação
      event.preventDefault();
      return true;
    }
  });
})();