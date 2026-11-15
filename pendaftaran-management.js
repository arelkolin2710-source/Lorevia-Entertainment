// Tampilan halaman "Pendaftaran management - Lorevia Entertainment" (route: pendaftaran-management).
// Markup disalin apa adanya dari versi satu file.
        function renderView() {
            const content = document.getElementById('appContent');
            if (currentRoute !== 'toko') stopPromoBanner();
            if (currentRoute === 'pendaftaran-management' && !appData.registrationOpen.management) {
                content.innerHTML = `
                    <div class="max-w-2xl mx-auto bg-forest-800/80 p-8 rounded-3xl gold-border backdrop-blur-md shadow-2xl my-8 text-center">
                        <span class="text-5xl">🔒</span>
                        <h2 class="font-serif text-3xl font-bold gold-text mt-4">Pendaftaran management Ditutup</h2>
                        <p class="text-sm text-gray-300 mt-3">Maaf, pendaftaran management saat ini sedang tidak dibuka. Silakan pantau terus pengumuman kami untuk info pembukaan pendaftaran berikutnya.</p>
                    </div>
                `;
            } else if (currentRoute === 'pendaftaran-management') {
                content.innerHTML = `
                    <div class="max-w-2xl mx-auto bg-forest-800/80 p-8 rounded-3xl gold-border backdrop-blur-md shadow-2xl my-8">
                        <div class="text-center mb-6">
                            <span class="text-4xl">🛡️</span>
                            <h2 class="font-serif text-3xl font-bold gold-text mt-2">Pendaftaran management</h2>
                            <p class="text-sm text-gray-300 mt-1">Bergabunglah bersama jajaran management profesional untuk mengelola Lorevia Entertainment.</p>
                        </div>
                        ${renderRegistrationForm('management')}
                    </div>
                `;
            }
            if (currentRoute === 'pendaftaran-management' && appData.registrationOpen.management) onRegDivisionChange('management');
            animatePageReveal();
        }
