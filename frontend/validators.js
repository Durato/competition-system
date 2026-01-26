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

  required: (value) => {
    return value && value.trim().length > 0;
  }
};