const Validators = {
  email: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  password: (password) => {
    // Mínimo 8 caracteres, pelo menos uma letra e um número
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  },

  phone: (phone) => {
    // Remove tudo que não é número
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10; // DDD + Número
  },

  file: (fileInput, maxSizeMB = 5) => {
    if (!fileInput.files || !fileInput.files[0]) return { valid: true }; // Opcional ou validado pelo 'required'
    
    const file = fileInput.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (!validTypes.includes(file.type)) {
      return { valid: false, error: "Apenas imagens (JPG, PNG, WEBP) são permitidas." };
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return { valid: false, error: `A imagem deve ter no máximo ${maxSizeMB}MB.` };
    }

    return { valid: true };
  },

  cpf: (cpf) => {
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    // Rejeitar sequências iguais (000.000.000-00, etc)
    if (/^(\d)\1{10}$/.test(clean)) return false;
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    if (parseInt(clean[9]) !== d1) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    if (parseInt(clean[10]) !== d2) return false;
    return true;
  },

  formatCPF: (value) => {
    const clean = value.replace(/\D/g, '').slice(0, 11);
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return clean.slice(0, 3) + '.' + clean.slice(3);
    if (clean.length <= 9) return clean.slice(0, 3) + '.' + clean.slice(3, 6) + '.' + clean.slice(6);
    return clean.slice(0, 3) + '.' + clean.slice(3, 6) + '.' + clean.slice(6, 9) + '-' + clean.slice(9);
  },

  required: (value) => {
    return value && value.trim().length > 0;
  }
};