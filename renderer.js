// Authentication check
if (sessionStorage.getItem('authenticated') !== 'true') {
    window.location.href = 'login.html';
}

// Clear unlocked tabs on every page load/refresh
// This ensures staff password is required again after any refresh
sessionStorage.removeItem('unlockedTabs');

// Data Storage using localStorage (must be defined before password functions)
const Storage = {
    get: (key) => {
        const data = localStorage.getItem(key);
        if (data === null) {
            // Return appropriate default based on key
            if (key === 'menuItemOrder') {
                return {};
            }
            if (key === 'loginPassword' || key === 'adminPassword') {
                return null;
            }
            return [];
        }
        // Handle passwords as plain strings
        if (key === 'loginPassword' || key === 'adminPassword') {
            // Try to parse as JSON first (in case it was stored as JSON), otherwise return as-is
            try {
                const parsed = JSON.parse(data);
                return typeof parsed === 'string' ? parsed : data;
            } catch (e) {
                return data;
            }
        }
        return JSON.parse(data);
    },
    set: (key, value) => {
        // Handle passwords as plain strings
        if (key === 'loginPassword' || key === 'adminPassword') {
            localStorage.setItem(key, value);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }
};

// Password management functions
function getLoginPassword() {
    return Storage.get('loginPassword') ?? '';
}

function getAdminPassword() {
    return Storage.get('adminPassword') ?? '';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Populate Year Dropdown
    const yearSelect = document.getElementById('reportAnnualYear');
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 2020; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            if (i === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }
});

// Staff password for restricted tabs
const ALLOWED_TABS_WITHOUT_STAFF_PASSWORD = ['pos', 'holdOrders'];
let pendingTabSwitch = null;

// Global delete confirmation state
let pendingDeleteAction = null;
let pendingDeleteButton = null;
let originalButtonHTML = null;

// Global unbook confirmation state
let pendingUnbookAction = null;
let pendingUnbookCard = null;
let unbookConfirmationContainer = null;

// Generic delete confirmation with tick/cross buttons
window.showDeleteConfirmation = (buttonElement, deleteFunction, ...args) => {
    // Cancel any existing pending delete
    if (pendingDeleteButton && pendingDeleteButton !== buttonElement) {
        cancelDeleteConfirmation();
    }

    pendingDeleteAction = () => deleteFunction(...args);

    // Store original button HTML
    originalButtonHTML = buttonElement.outerHTML;

    // Replace button with tick/cross buttons (inline, smaller size)
    const container = document.createElement('span');
    container.style.cssText = 'display: inline-flex; gap: 4px; align-items: center; vertical-align: middle;';
    container.innerHTML = `
        <button type="button" onclick="confirmDelete()" style="background: #4caf50; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Confirm">✓</button>
        <button type="button" onclick="cancelDeleteConfirmation()" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Cancel">✕</button>
    `;

    buttonElement.replaceWith(container);
    pendingDeleteButton = container;
};

window.confirmDelete = () => {
    if (pendingDeleteAction) {
        pendingDeleteAction();
        cancelDeleteConfirmation();
    }
};

window.cancelDeleteConfirmation = () => {
    if (pendingDeleteButton && originalButtonHTML) {
        const container = pendingDeleteButton;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalButtonHTML;
        const restoredButton = tempDiv.firstElementChild;
        container.replaceWith(restoredButton);
    }

    pendingDeleteAction = null;
    pendingDeleteButton = null;
    originalButtonHTML = null;
};

// Staff password modal functions
window.openStaffPasswordModal = (tab) => {
    if (getAdminPassword() === '' && getLoginPassword() === '') {
        switchToTab(tab);
        // Ensure the nav button is also updated
        const navButton = document.querySelector(`.nav-item[data-tab="${tab}"]`);
        if (navButton) {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            navButton.classList.add('active');
        }
        return;
    }
    pendingTabSwitch = tab;
    const modal = document.getElementById('staffPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('staffPasswordInput').value = '';
        document.getElementById('staffPasswordError').style.display = 'none';
        setTimeout(() => {
            document.getElementById('staffPasswordInput').focus();
        }, 100);

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeStaffPasswordModal();
            }
        };
    }
};

window.closeStaffPasswordModal = () => {
    const modal = document.getElementById('staffPasswordModal');
    if (modal) {
        modal.style.display = 'none';
        pendingTabSwitch = null;
        document.getElementById('staffPasswordInput').value = '';
        document.getElementById('staffPasswordError').style.display = 'none';
    }
};

window.handleStaffPassword = (event) => {
    event.preventDefault();
    const passwordInput = document.getElementById('staffPasswordInput');
    const errorMessage = document.getElementById('staffPasswordError');
    const enteredPassword = passwordInput.value.trim();

    const adminPass = getAdminPassword();
    const loginPass = getLoginPassword();
    const isCorrect = (adminPass !== '' && enteredPassword === adminPass) || 
                      (loginPass !== '' && enteredPassword === loginPass);

    if (isCorrect) {
        // Track the unlocked tab
        if (pendingTabSwitch) {
            const unlockedTabs = JSON.parse(sessionStorage.getItem('unlockedTabs') || '[]');
            if (!unlockedTabs.includes(pendingTabSwitch)) {
                unlockedTabs.push(pendingTabSwitch);
                sessionStorage.setItem('unlockedTabs', JSON.stringify(unlockedTabs));
            }
        }

        // Get the tab to switch to before closing modal
        const tabToSwitch = pendingTabSwitch;
        closeStaffPasswordModal();

        // Switch to the pending tab after a small delay to ensure modal is closed
        if (tabToSwitch) {
            setTimeout(() => {
                switchToTab(tabToSwitch);
                // Ensure the nav button is also updated
                const navButton = document.querySelector(`.nav-item[data-tab="${tabToSwitch}"]`);
                if (navButton) {
                    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                    navButton.classList.add('active');
                }
            }, 150);
        }
    } else {
        errorMessage.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }
};

// Generic password modal for delete/edit actions
let pendingActionCallback = null;
let pendingActionPasswordType = 'admin';

window.openActionPasswordModal = (callback, passwordType = 'admin') => {
    const requiredPassword = passwordType === 'login' ? getLoginPassword() : getAdminPassword();
    if (requiredPassword === '') {
        if (callback) callback();
        return;
    }
    pendingActionCallback = callback;
    pendingActionPasswordType = passwordType;
    const modal = document.getElementById('actionPasswordModal');
    if (modal) {
        modal.style.display = 'flex';
        
        // Update modal title and text based on type
        const headerText = modal.querySelector('.modal-header h3');
        const bodyText = modal.querySelector('.modal-body p');
        if (headerText) headerText.textContent = passwordType === 'login' ? 'Login Password Required' : 'Admin Access Required';
        if (bodyText) bodyText.textContent = passwordType === 'login' ? 'This section requires login password to access.' : 'This section requires admin password to access.';
        const passwordInput = document.getElementById('actionPasswordInput');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
        const errorMessage = document.getElementById('actionPasswordError');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeActionPasswordModal();
            }
        };
    }
};

window.closeActionPasswordModal = (clearCallback = true) => {
    const modal = document.getElementById('actionPasswordModal');
    if (modal) {
        modal.style.display = 'none';
        const passwordInput = document.getElementById('actionPasswordInput');
        if (passwordInput) {
            passwordInput.value = '';
        }
        const errorMessage = document.getElementById('actionPasswordError');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }
    // Only clear callback if explicitly requested (not when password is correct)
    if (clearCallback) {
        pendingActionCallback = null;
    }
};

window.handleActionPassword = (event) => {
    event.preventDefault();
    const passwordInput = document.getElementById('actionPasswordInput');
    const errorMessage = document.getElementById('actionPasswordError');
    const enteredPassword = passwordInput.value.trim();

    const requiredPassword = pendingActionPasswordType === 'login' ? getLoginPassword() : getAdminPassword();

    if (enteredPassword === requiredPassword) {
        // Store the callback before closing modal
        const callback = pendingActionCallback;

        // Close modal without clearing callback
        closeActionPasswordModal(false);

        // Execute the pending action after a small delay
        if (callback) {
            setTimeout(() => {
                callback();
                pendingActionCallback = null;
            }, 150);
        }
    } else {
        if (errorMessage) {
            errorMessage.style.display = 'block';
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
};

// Advanced Settings Modal Functions
window.openAdvancedSettingsModal = () => {
    const modal = document.getElementById('advancedSettingsModal');
    if (modal) {
        modal.style.display = 'flex';
        // Reset form
        document.getElementById('advancedSettingsForm').reset();
        document.getElementById('advancedSettingsError').style.display = 'none';
        document.getElementById('advancedSettingsSuccess').style.display = 'none';

        // Close modal when clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeAdvancedSettingsModal();
            }
        };
    }
};

window.closeAdvancedSettingsModal = () => {
    const modal = document.getElementById('advancedSettingsModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('advancedSettingsForm').reset();
        document.getElementById('advancedSettingsError').style.display = 'none';
        document.getElementById('advancedSettingsSuccess').style.display = 'none';
    }
};

// Toggle password visibility
window.togglePasswordVisibility = (inputId, button) => {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        button.title = 'Hide password';
    } else {
        input.type = 'password';
        button.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        button.title = 'Show password';
    }
};

window.saveAdvancedSettings = (event) => {
    event.preventDefault();
    const errorDiv = document.getElementById('advancedSettingsError');
    const successDiv = document.getElementById('advancedSettingsSuccess');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Get password values
    const currentLoginPassword = document.getElementById('currentLoginPassword').value.trim();
    const newLoginPassword = document.getElementById('newLoginPassword').value.trim();
    const currentAdminPassword = document.getElementById('currentAdminPassword').value.trim();
    const newAdminPassword = document.getElementById('newAdminPassword').value.trim();

    let hasChanges = false;
    let errors = [];

    // Validate and update login password
    if (newLoginPassword) {
        const stored = getLoginPassword();
        if (stored !== '' && !currentLoginPassword) {
            errors.push('Please enter current login password.');
        } else if (stored !== '' && currentLoginPassword !== stored) {
            errors.push('Current login password is incorrect.');
        } else {
            Storage.set('loginPassword', newLoginPassword);
            hasChanges = true;
        }
    }

    // Validate and update admin password
    if (newAdminPassword) {
        const stored = getAdminPassword();
        if (stored !== '' && !currentAdminPassword) {
            errors.push('Please enter current admin password.');
        } else if (stored !== '' && currentAdminPassword !== stored) {
            errors.push('Current admin password is incorrect.');
        } else {
            Storage.set('adminPassword', newAdminPassword);
            hasChanges = true;
        }
    }

    // Check if no changes were made
    if (!currentLoginPassword && !newLoginPassword && !currentAdminPassword && !newAdminPassword) {
        errors.push('Please make at least one change.');
    }

    // Display errors or success
    if (errors.length > 0) {
        errorDiv.textContent = errors.join(' ');
        errorDiv.style.display = 'block';
    } else if (hasChanges) {
        successDiv.textContent = 'Settings saved successfully!';
        successDiv.style.display = 'block';

        // Clear password fields
        document.getElementById('currentLoginPassword').value = '';
        document.getElementById('newLoginPassword').value = '';
        document.getElementById('currentAdminPassword').value = '';
        document.getElementById('newAdminPassword').value = '';

        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
};

window.removePassword = (type) => {
    const currentInputId = type === 'login' ? 'currentLoginPassword' : 'currentAdminPassword';
    const currentPasswordInput = document.getElementById(currentInputId);
    const enteredPassword = currentPasswordInput.value.trim();
    const storedPassword = type === 'login' ? getLoginPassword() : getAdminPassword();
    const errorDiv = document.getElementById('advancedSettingsError');
    const successDiv = document.getElementById('advancedSettingsSuccess');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    if (!enteredPassword) {
        errorDiv.textContent = `Please enter current ${type} password to disable it.`;
        errorDiv.style.display = 'block';
        currentPasswordInput.focus();
        return;
    }

    if (enteredPassword !== storedPassword) {
        errorDiv.textContent = `Incorrect current ${type} password.`;
        errorDiv.style.display = 'block';
        currentPasswordInput.value = '';
        currentPasswordInput.focus();
        return;
    }

    // Clear the password
    Storage.set(type === 'login' ? 'loginPassword' : 'adminPassword', '');

    successDiv.textContent = `${type === 'login' ? 'Login' : 'Admin'} password has been disabled.`;
    successDiv.style.display = 'block';

    // Reset inputs
    document.getElementById('currentLoginPassword').value = '';
    document.getElementById('newLoginPassword').value = '';
    document.getElementById('currentAdminPassword').value = '';
    document.getElementById('newAdminPassword').value = '';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
};

// Function to switch to a tab
function switchToTab(tab) {
    // Find the nav button for this tab
    const navButton = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if (!navButton) return;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    navButton.classList.add('active');

    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const targetTab = document.getElementById(tab);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Scroll to top when switching tabs
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.scrollTop = 0;
    }

    // Show/hide order section and adjust layout
    const orderSectionWrapper = document.getElementById('orderSectionWrapper');

    if (tab === 'pos') {
        // Show order section for POS
        if (orderSectionWrapper) orderSectionWrapper.classList.add('show');
        if (mainContent) mainContent.classList.add('has-order-section');
        loadCategories();
        loadMenuItems();
        loadWaitersDropdown();
        loadTablesDropdown();
        updateCart();
        updateOrderDate();
    } else {
        // Hide order section for other tabs
        if (orderSectionWrapper) orderSectionWrapper.classList.remove('show');
        if (mainContent) mainContent.classList.remove('has-order-section');

        if (tab === 'menu') {
            loadMenuCategories();
            loadMenuItemsList();
            setupMenuItemsSearch();
        }
        else if (tab === 'sales') {
            setupSalesFilters();
            // Ensure Sales History tab is active on initial load (this will properly reset all buttons)
            switchSalesView('history');
            loadSales();
        }
        else if (tab === 'dashboard') {
            loadDashboard();
            setTimeout(() => {
                if (!salesChart || !profitChart || !customerChart) {
                    initCharts();
                }
                updateCharts();
            }, 100);
        }
        else if (tab === 'holdOrders') loadHoldOrders();
        else if (tab === 'employees') {
            setupEmployeeFilters();
            loadEmployees();
            loadWaiters();
        }
        else if (tab === 'expenses') {
            setupExpensesFilters();
            loadExpenses();
        }
        else if (tab === 'stock') loadStock();
        else if (tab === 'tables') loadTables();
        else if (tab === 'reports') {
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('reportDailyDate');
            if (dateInput && !dateInput.value) dateInput.value = today;
        }
    }
}

// Global variables
let currentDiscount = { type: null, value: 0 }; // Track current discount
const SALES_TAX_RATE = 0.05; // 5% sales tax
const SERVICE_CHARGE_RATE = 0.10; // 10% service charge

// Image cache for optimized display images
const imageDisplayCache = new Map();

// Compress image for display (smaller than upload compression for better performance)
function compressImageForDisplay(imageSrc, maxWidth = 200, maxHeight = 200, quality = 0.6, callback) {
    if (!callback) return;

    // Check cache first
    const cacheKey = `${imageSrc}_${maxWidth}_${maxHeight}_${quality}`;
    if (imageDisplayCache.has(cacheKey)) {
        callback(imageDisplayCache.get(cacheKey));
        return;
    }

    // If it's already a placeholder or data URL that's small, return as-is
    if (!imageSrc || imageSrc.startsWith('data:image/svg+xml')) {
        callback(imageSrc);
        return;
    }

    // If image is already small (less than 50KB in base64), skip compression
    if (imageSrc.startsWith('data:image') && imageSrc.length < 50000) {
        callback(imageSrc);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
        callback(imageSrc); // Fallback to original on timeout
    }, 5000);

    img.onload = function () {
        clearTimeout(timeout);
        try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Skip if image is already small enough
            if (width <= maxWidth && height <= maxHeight) {
                callback(imageSrc);
                return;
            }

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to base64 with compression
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

            // Only cache if compression actually reduced size
            if (compressedDataUrl.length < imageSrc.length) {
                imageDisplayCache.set(cacheKey, compressedDataUrl);

                // Limit cache size to prevent memory issues
                if (imageDisplayCache.size > 100) {
                    const firstKey = imageDisplayCache.keys().next().value;
                    imageDisplayCache.delete(firstKey);
                }

                callback(compressedDataUrl);
            } else {
                // Original was smaller, use it
                callback(imageSrc);
            }
        } catch (error) {
            clearTimeout(timeout);
            console.error('Error compressing image:', error);
            callback(imageSrc); // Fallback to original
        }
    };

    img.onerror = function () {
        clearTimeout(timeout);
        callback(imageSrc); // Fallback to original on error
    };

    img.src = imageSrc;
}

// Lazy loading setup for menu images
let imageObserver = null;

function setupLazyLoading() {
    // First, load any images that are already visible (fallback for IntersectionObserver)
    document.querySelectorAll('img[data-src]').forEach(img => {
        const rect = img.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
        if (isVisible) {
            const originalSrc = img.dataset.src;
            if (originalSrc) {
                compressImageForDisplay(originalSrc, 200, 200, 0.6, (compressedSrc) => {
                    img.src = compressedSrc;
                    img.removeAttribute('data-src');
                    img.classList.add('loaded');
                });
            }
        }
    });

    // Then setup IntersectionObserver for remaining images
    if ('IntersectionObserver' in window) {
        // Disconnect existing observer if any
        if (imageObserver) {
            imageObserver.disconnect();
        }

        imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const originalSrc = img.dataset.src;
                    if (originalSrc) {
                        // Compress and load image
                        compressImageForDisplay(originalSrc, 200, 200, 0.6, (compressedSrc) => {
                            if (img.parentElement) { // Make sure image is still in DOM
                                img.src = compressedSrc;
                                img.removeAttribute('data-src');
                                img.classList.add('loaded');
                            }
                        });
                    }
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '100px' // Start loading 100px before image enters viewport
        });

        // Observe all remaining lazy images
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    } else {
        // Fallback: load all images if IntersectionObserver is not supported
        document.querySelectorAll('img[data-src]').forEach(img => {
            const originalSrc = img.dataset.src;
            if (originalSrc) {
                compressImageForDisplay(originalSrc, 200, 200, 0.6, (compressedSrc) => {
                    img.src = compressedSrc;
                    img.removeAttribute('data-src');
                    img.classList.add('loaded');
                });
            }
        });
    }
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Order number helpers
function extractOrderNumber(value) {
    if (!value) return null;
    const match = String(value).match(/(\d+)/);
    return match ? match[1] : null;
}

function initializeOrderSequence() {
    let seq = Storage.get('orderSequence');
    if (seq) return seq;
    const sales = Storage.get('sales') || [];
    const holdOrders = Storage.get('holdOrders') || [];
    let max = 0;
    [...sales, ...holdOrders].forEach(order => {
        const numStr = order?.orderNumber || extractOrderNumber(order?.orderId || order?.id);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > max) max = num;
    });
    Storage.set('orderSequence', max);
    return max;
}

function getNextOrderNumber() {
    let seq = Storage.get('orderSequence');
    if (seq === null || seq === undefined) {
        seq = initializeOrderSequence() || 0;
    }
    const next = Number(seq) + 1;
    Storage.set('orderSequence', next);
    return String(next).padStart(7, '0');
}

// Format number with commas only for 10,000+
function formatNumber(num) {
    const rounded = Math.round(num);
    if (rounded >= 10000) {
        return rounded.toLocaleString();
    }
    return rounded.toString();
}

// Format quantity to show decimals when needed
function formatQuantity(num) {
    if (num % 1 === 0) {
        // It's a whole number, show without decimals
        return num.toString();
    } else {
        // It has decimals, show up to 2 decimal places
        return parseFloat(num).toFixed(2).replace(/\.?0+$/, '');
    }
}

// Format date as "12-Dec-2025"
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
}

// Helper function to format items as HTML table for receipts
function formatReceiptItems(items) {
    if (!items || items.length === 0) return '';

    // Return HTML table format with grid borders and proper text alignment
    let result = '<table style="width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 9px; font-family: \'Poppins\', Arial, sans-serif; border: 1px solid #000;">';
    result += '<thead>';
    result += '<tr style="border-bottom: 1px solid #000; background-color: #f2f2f2;">';
    result += '<th style="text-align: left; padding: 4px 6px; font-weight: bold; border-right: 1px solid #000; width: 45%;">Item</th>';
    result += '<th style="text-align: right; padding: 4px 6px; font-weight: bold; border-right: 1px solid #000; width: 15%;">Qty</th>';
    result += '<th style="text-align: right; padding: 4px 6px; font-weight: bold; border-right: 1px solid #000; width: 20%;">Price</th>';
    result += '<th style="text-align: right; padding: 4px 6px; font-weight: bold; width: 20%;">Total</th>';
    result += '</tr>';
    result += '</thead>';
    result += '<tbody>';

    items.forEach((item, index) => {
        const name = item.name || 'Unknown';
        const quantity = formatQuantity(item.quantity || 0);
        const unitPrice = item.price || 0;
        const totalPrice = unitPrice * (item.quantity || 0);
        
        // Add a bottom border to every row except the last one to make it clean
        const rowStyle = index === items.length - 1 ? '' : 'border-bottom: 1px solid #000;';

        result += `<tr style="${rowStyle}">`;
        result += `<td style="text-align: left; padding: 4px 6px; font-weight: 500; border-right: 1px solid #000;">${name}</td>`;
        result += `<td style="text-align: right; padding: 4px 6px; font-weight: 500; border-right: 1px solid #000;">${quantity}</td>`;
        result += `<td style="text-align: right; padding: 4px 6px; font-weight: 500; border-right: 1px solid #000;">${formatNumber(unitPrice)}</td>`;
        result += `<td style="text-align: right; padding: 4px 6px; font-weight: 500;">${formatNumber(totalPrice)}</td>`;
        result += '</tr>';
    });

    result += '</tbody>';
    result += '</table>\n';

    return result;
}

// Helper function to format receipt summary as HTML table
function formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total) {
    const rows = [];
    
    rows.push({
        label: t('Subtotal'),
        value: `Rs.${formatNumber(subtotal)}`
    });

    if (discountAmount > 0) {
        rows.push({
            label: t('Discount'),
            value: `-Rs.${formatNumber(discountAmount)}`
        });
    }

    if (tax > 0) {
        rows.push({
            label: 'GST (5%)',
            value: `Rs.${formatNumber(tax)}`
        });
    }

    if (serviceCharges > 0) {
        rows.push({
            label: 'Service Charges (10%)',
            value: `Rs.${formatNumber(serviceCharges)}`
        });
    }

    let result = '<table style="width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 9px; font-family: \'Poppins\', Arial, sans-serif; border: 1px solid #000;">';
    result += '<thead>';
    result += '<tr style="border-bottom: 1px solid #000; background-color: #f2f2f2;">';
    result += '<th style="text-align: left; padding: 4px 6px; font-weight: bold; border-right: 1px solid #000; width: 65%;">Description</th>';
    result += '<th style="text-align: right; padding: 4px 6px; font-weight: bold; width: 35%;">Amount</th>';
    result += '</tr>';
    result += '</thead>';
    result += '<tbody>';

    rows.forEach(row => {
        result += '<tr style="border-bottom: 1px solid #000;">';
        result += `<td style="text-align: left; padding: 4px 6px; font-weight: 500; border-right: 1px solid #000;">${row.label}</td>`;
        result += `<td style="text-align: right; padding: 4px 6px; font-weight: 500;">${row.value}</td>`;
        result += '</tr>';
    });

    // Grand Total row
    result += '<tr style="background-color: #f2f2f2; font-size: 11px;">';
    result += `<td style="text-align: left; padding: 5px 6px; font-weight: 900; border-right: 1px solid #000;">Grand Total</td>`;
    result += `<td style="text-align: right; padding: 5px 6px; font-weight: 900;">Rs.${formatNumber(total)}</td>`;
    result += '</tr>';

    result += '</tbody>';
    result += '</table>\n';

    return result;
}

function formatKOTItems(items) {
    if (!items || items.length === 0) return '';

    // Return HTML table format with grid borders and proper text alignment
    let result = '<table style="width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 12px; font-family: Arial, sans-serif; display: table; border: 1px solid #000;">';
    result += '<thead>';
    result += '<tr style="border-bottom: 1px solid #000; background-color: #f2f2f2;">';
    result += '<th style="text-align: left; padding: 4px 6px; font-weight: bold; font-size: 12px; border-right: 1px solid #000; width: 75%;">Item</th>';
    result += '<th style="text-align: right; padding: 4px 6px; font-weight: bold; font-size: 12px; width: 25%;">Qty</th>';
    result += '</tr>';
    result += '</thead>';
    result += '<tbody>';

    items.forEach((item, index) => {
        const name = escapeHtml(item.name || 'Unknown');
        const quantity = formatQuantity(item.quantity || 0);

        const rowStyle = index === items.length - 1 ? '' : 'border-bottom: 1px solid #000;';

        result += `<tr style="${rowStyle}">`;
        result += `<td style="text-align: left; padding: 4px 6px; font-weight: bold; font-size: 11px; border-right: 1px solid #000;">${name}</td>`;
        result += `<td style="text-align: right; padding: 4px 6px; font-weight: bold; font-size: 11px;">${quantity}</td>`;
        result += '</tr>';
    });

    result += '</tbody>';
    result += '</table>';

    return result;
}

// Format time as "09:00 PM"
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Calculate order receive time (add 40 minutes to order time)
function calculateReceiveTime(orderTime, orderDate) {
    if (!orderTime && !orderDate) return '';

    let orderDateTime;

    // If we have a date object, use it directly
    if (orderDate instanceof Date) {
        orderDateTime = new Date(orderDate);
    } else if (orderDate) {
        // Try to parse date string (could be ISO string or formatted date)
        orderDateTime = new Date(orderDate);
        // If parsing failed, try to parse formatted date like "09-Jan-2026"
        if (isNaN(orderDateTime.getTime())) {
            // Try parsing common date formats
            const dateStr = String(orderDate);
            const dateMatch = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/);
            if (dateMatch) {
                const day = parseInt(dateMatch[1], 10);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = monthNames.indexOf(dateMatch[2]);
                const year = parseInt(dateMatch[3], 10);
                if (month !== -1) {
                    orderDateTime = new Date(year, month, day);
                } else {
                    orderDateTime = new Date();
                }
            } else {
                orderDateTime = new Date();
            }
        }
    } else {
        // Use current date if no date provided
        orderDateTime = new Date();
    }

    // If we have a time string (like "02:09 PM"), parse it
    if (orderTime && typeof orderTime === 'string') {
        const timeMatch = orderTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const ampm = timeMatch[3].toUpperCase();

            // Convert to 24-hour format
            if (ampm === 'PM' && hours !== 12) {
                hours += 12;
            } else if (ampm === 'AM' && hours === 12) {
                hours = 0;
            }

            // Set the time on the date object
            orderDateTime.setHours(hours, minutes, 0, 0);
        }
    } else if (!orderTime && orderDate instanceof Date) {
        // If no time string but we have a date object, use its time
        // (already set above, no need to change)
    }

    // Validate that we have a valid date/time
    if (isNaN(orderDateTime.getTime())) {
        // Fallback: use current time if date parsing failed
        orderDateTime = new Date();
    }

    // Add 40 minutes
    orderDateTime.setMinutes(orderDateTime.getMinutes() + 40);

    // Format and return - ensure we always return a valid time string
    try {
        const receiveTime = orderDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        if (receiveTime && receiveTime.trim()) {
            return receiveTime;
        }
    } catch (e) {
        // If formatting fails, fallback to current time + 40 minutes
        const fallbackTime = new Date();
        fallbackTime.setMinutes(fallbackTime.getMinutes() + 40);
        return fallbackTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Final fallback
    const fallbackTime = new Date();
    fallbackTime.setMinutes(fallbackTime.getMinutes() + 40);
    return fallbackTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// -------------------------
// i18n (English / Urdu)
// -------------------------
let currentLanguage = localStorage.getItem('appLanguage') || 'en';

const I18N_UR = {
    // Common
    'Restaurant Management System': 'ریسٹورنٹ مینجمنٹ سسٹم',
    'Restaurant': 'ریسٹورنٹ',
    'New Order': 'نیا آرڈر',
    'Hold Orders': 'ہولڈ آرڈرز',
    'Sales': 'سیلز',
    'Menu': 'مینو',
    'Employees': 'ملازمین',
    'Expenses': 'اخراجات',
    'Tables': 'ٹیبلز',
    'Dashboard': 'ڈیش بورڈ',
    'Search items...': 'اشیاء تلاش کریں...',
    'Favourites': 'پسندیدہ',
    'All': 'سب',
    'Gents': 'جینٹس',
    'Family': 'فیملی',
    // Backward compatibility (in case any old UI text still says Cash/Online)
    'Cash': 'جینٹس',
    'Online': 'فیملی',
    'Parcel': 'پارسل',
    'Delivery': 'پارسل',

    // Sales / Orders
    'ORDER ID': 'آرڈر نمبر',
    'Order ID': 'آرڈر نمبر',
    'Order ID:': 'آرڈر نمبر:',
    'ORDER NO': 'آرڈر نمبر',
    'Order No': 'آرڈر نمبر',
    'Order No.': 'آرڈر نمبر',
    'Order No.:': 'آرڈر نمبر:',
    'DATE': 'تاریخ',
    'Date': 'تاریخ',
    'Date:': 'تاریخ:',
    'Payment': 'ادائیگی',
    'PAYMENT METHOD': 'ادائیگی کا طریقہ',
    'Payment Method': 'ادائیگی کا طریقہ',
    'Payment Method:': 'ادائیگی کا طریقہ:',
    'Location': 'لوکیشن',
    'Location:': 'لوکیشن:',
    'Gents Hall': 'جینٹس ہال',
    'Family Hall': 'فیملی ہال',
    'TOTAL': 'کل',
    'Total': 'کل',
    'Items:': 'اشیاء:',
    'Items': 'اشیاء',
    'Subtotal': 'ذیلی کل',
    'Discount': 'رعایت',
    'Attendance': 'حاضری',
    'Time In': 'حاضری',
    'Time Out': 'چھٹی',
    'No attendance found': 'کوئی حاضری موجود نہیں',
    'Apply': 'لگائیں',
    'Remove': 'ہٹائیں',
    'Print': 'پرنٹ',
    'Delete': 'حذف',
    'Edit': 'ترمیم',
    'Complete': 'مکمل',
    'View Sale': 'سیل دیکھیں',

    // Hold orders/table text
    'Pending Orders': 'زیرِ التواء آرڈرز',
    'No pending orders': 'کوئی زیرِ التواء آرڈر نہیں',
    'No booking': 'کوئی بکنگ نہیں',
    'Book Table': 'ٹیبل بک کریں',
    'Customer Name *': 'گاہک کا نام *',
    'Contact *': 'رابطہ *',
    'Cancel': 'منسوخ',
    'Save': 'محفوظ کریں',

    // Receipts
    'ABC Restaurant': 'اے بی سی ریسٹورنٹ',
    'Order ID: ': 'آرڈر نمبر: ',
    'Order No.: ': 'آرڈر نمبر: ',
    'Date: ': 'تاریخ: ',
    'Payment: ': 'ادائیگی: ',
    'ITEMS:': 'اشیاء:',
    'TOTAL: ': 'کل: ',
    'Thank You!': 'شکریہ!',
    'Software Developed by Salik': 'سافٹ ویئر تیار کردہ: سلیک',
    'Contact: 0309-5369472': 'رابطہ: 0309-5369472',

    // Common dialogs (best-effort)
    'Order not found!': 'آرڈر نہیں ملا!',
    'No items in cart': 'کارٹ میں کوئی آئٹم نہیں',
};

const __i18nTextNodeOriginal = new WeakMap();
let __i18nTranslateScheduled = false;

function t(text) {
    if (currentLanguage !== 'ur') return text;
    return I18N_UR[text] || text;
}

function translateTextNode(node) {
    // Skip translation for explicitly marked sections
    if (node.parentElement && node.parentElement.closest && node.parentElement.closest('[data-no-i18n="true"]')) {
        return;
    }

    const original = __i18nTextNodeOriginal.get(node) ?? node.nodeValue;
    if (!__i18nTextNodeOriginal.has(node)) __i18nTextNodeOriginal.set(node, original);

    if (currentLanguage === 'en') {
        node.nodeValue = original;
        return;
    }

    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = I18N_UR[trimmed];
    node.nodeValue = translated ? original.replace(trimmed, translated) : original;
}

function translatePlaceholders() {
    document.querySelectorAll('[placeholder]').forEach(el => {
        if (!el.dataset.i18nPlaceholderEn) {
            el.dataset.i18nPlaceholderEn = el.getAttribute('placeholder') || '';
        }
        const en = el.dataset.i18nPlaceholderEn;
        if (!en) return;
        el.setAttribute('placeholder', currentLanguage === 'ur' ? (I18N_UR[en] || en) : en);
    });
}

function translateDocument() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
        translateTextNode(node);
    }
    translatePlaceholders();
}

function scheduleTranslateDocument() {
    if (__i18nTranslateScheduled) return;
    __i18nTranslateScheduled = true;
    queueMicrotask(() => {
        __i18nTranslateScheduled = false;
        translateDocument();
    });
}

function updateLanguageButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });
}

function setLanguage(lang) {
    currentLanguage = (lang === 'ur') ? 'ur' : 'en';
    localStorage.setItem('appLanguage', currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === 'ur' ? 'rtl' : 'ltr';
    updateLanguageButtons();
    translateDocument();
}

function initI18n() {
    // Translate system dialogs (best-effort based on exact matches in I18N_UR)
    const __alert = window.alert.bind(window);
    const __confirm = window.confirm.bind(window);

    // Keep track of last focused element so we can restore focus after native dialogs
    let __lastFocusedEl = document.activeElement;
    document.addEventListener('focusin', (e) => {
        __lastFocusedEl = e.target;
    }, true);

    const __restoreFocusSoon = () => {
        setTimeout(() => {
            try { window.focus(); } catch (_) { }
            const el = __lastFocusedEl;
            if (el && typeof el.focus === 'function' && document.contains(el)) {
                try { el.focus({ preventScroll: true }); } catch (_) {
                    try { el.focus(); } catch (_) { }
                }
            }
        }, 0);
    };

    window.alert = (msg) => {
        try { window.__inNativeDialog = true; } catch (_) { }
        __alert(t(String(msg)));
        try { window.__inNativeDialog = false; } catch (_) { }
        __restoreFocusSoon();
    };

    window.confirm = (msg) => {
        try { window.__inNativeDialog = true; } catch (_) { }
        const res = __confirm(t(String(msg)));
        try { window.__inNativeDialog = false; } catch (_) { }
        __restoreFocusSoon();
        return res;
    };

    // Wire toggle buttons
    const switchEl = document.getElementById('langSwitch');
    if (switchEl) {
        switchEl.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('.lang-btn') : null;
            if (!btn) return;
            setLanguage(btn.dataset.lang);
        });
    }

    // Observe DOM changes so dynamically-rendered content also translates
    const observer = new MutationObserver(() => scheduleTranslateDocument());
    observer.observe(document.body, { childList: true, subtree: true });

    setLanguage(currentLanguage);
}

function formatPaymentMethod(method) {
    const m = (method || 'cash').toString().toLowerCase();
    if (m === 'delivery') return currentLanguage === 'ur' ? 'پارسل' : 'Parcel';
    if (m === 'parcel') return currentLanguage === 'ur' ? 'پارسل' : 'Parcel';
    if (m === 'cash') return currentLanguage === 'ur' ? I18N_UR['Gents'] : 'Gents';
    if (m === 'online') return currentLanguage === 'ur' ? I18N_UR['Family'] : 'Family';
    return currentLanguage === 'ur' ? (I18N_UR[m] || m) : (m.charAt(0).toUpperCase() + m.slice(1));
}

// Location label for Sales/Prints
function formatLocation(method) {
    const m = (method || 'cash').toString().toLowerCase();
    if (m === 'delivery') return currentLanguage === 'ur' ? 'پارسل' : 'Parcel';
    if (m === 'parcel') return currentLanguage === 'ur' ? 'پارسل' : 'Parcel';
    if (m === 'cash') return currentLanguage === 'ur' ? I18N_UR['Gents Hall'] : 'Gents Hall';
    if (m === 'online') return currentLanguage === 'ur' ? I18N_UR['Family Hall'] : 'Family Hall';
    return currentLanguage === 'ur' ? (I18N_UR[m] || m) : (m.charAt(0).toUpperCase() + m.slice(1));
}

// Format time like "2:34 PM" (used for payouts, etc.)
function formatTimeShort(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Format time like "2:34:56 PM" (used for live clock)
function formatTimeShortWithSeconds(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// Convert 24-hour time string (e.g., "13:30") to 12-hour format (e.g., "1:30 PM")
function formatTime12Hour(time24) {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const min = minutes || '00';
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return `${hour12}:${min} ${period}`;
}

function getDiscountAmountFromOrder(order, subtotalFallback = 0) {
    if (!order) return 0;
    const discount = order.discount;
    if (!discount) return 0;
    if (typeof discount.amount === 'number') return discount.amount;
    const subtotal = typeof order.subtotal === 'number' ? order.subtotal : subtotalFallback;
    if (discount.type === 'fixed') return Math.min(Number(discount.value || 0), subtotal);
    if (discount.type === 'percentage') return (subtotal * Number(discount.value || 0)) / 100;
    return 0;
}

// Cart Management
let cart = [];
let originalHoldOrderItems = []; // Store items before editing a hold order
let editingHoldOrderId = null; // Track which hold order is being edited
let currentCustomerName = ''; // Store customer name for receipts

// Function to show inline message over a button
function showButtonMessage(buttonElement, message) {
    if (!buttonElement) return;

    // Remove any existing message
    const existingMessage = document.querySelector('.button-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = 'button-message';
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        background: #e74c3c;
        color: white;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
        pointer-events: none;
        font-family: 'Poppins', 'Inter', sans-serif;
    `;

    // Position message above the button using fixed positioning
    const buttonRect = buttonElement.getBoundingClientRect();
    messageEl.style.top = `${buttonRect.top - 45}px`;
    messageEl.style.left = `${buttonRect.left + (buttonRect.width / 2)}px`;
    messageEl.style.transform = 'translateX(-50%)';

    document.body.appendChild(messageEl);

    // Function to remove the message
    const removeMessage = () => {
        if (messageEl.parentElement) {
            messageEl.remove();
        }
    };

    // Remove message when clicking anywhere
    const clickHandler = (e) => {
        // Don't remove if clicking on the message itself
        if (!messageEl.contains(e.target)) {
            removeMessage();
            document.removeEventListener('click', clickHandler);
        }
    };

    // Add click listener after a small delay to avoid immediate removal
    setTimeout(() => {
        document.addEventListener('click', clickHandler);
    }, 10);

    // Remove message after 3 seconds
    setTimeout(() => {
        removeMessage();
        document.removeEventListener('click', clickHandler);
    }, 3000);
}

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // If editing an order and switching away from POS, cancel edit
        if (editingHoldOrderId && tab !== 'pos') {
            if (confirm('You are editing an order. Cancel editing and switch tab?')) {
                cancelEditHoldOrder();
            } else {
                return; // Don't switch tabs
            }
        }

        // Check if tab requires staff password (all tabs except pos and holdOrders)
        if (!ALLOWED_TABS_WITHOUT_STAFF_PASSWORD.includes(tab)) {
            // Check if THIS SPECIFIC TAB is authenticated
            const unlockedTabs = JSON.parse(sessionStorage.getItem('unlockedTabs') || '[]');
            if (!unlockedTabs.includes(tab)) {
                // Show password prompt
                openStaffPasswordModal(tab);
                return; // Don't switch tabs yet
            }
        }

        // Switch to the tab
        switchToTab(tab);
    });
});

// Initialize language after the DOM is ready (renderer.js is loaded at end of body)
initI18n();

// Check on page load if current tab requires staff password
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure DOM is fully ready
    setTimeout(() => {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            if (!ALLOWED_TABS_WITHOUT_STAFF_PASSWORD.includes(tabId)) {
                const unlockedTabs = JSON.parse(sessionStorage.getItem('unlockedTabs') || '[]');
                if (!unlockedTabs.includes(tabId)) {
                    // Switch to POS tab if not authenticated
                    switchToTab('pos');
                    // Update nav button
                    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                    const posNav = document.querySelector('.nav-item[data-tab="pos"]');
                    if (posNav) posNav.classList.add('active');
                }
            }
        }
    }, 50);
});

// Menu Category Management
let editingCategoryId = null;

// Add Category Modal Form Handler
const addCategoryForm = document.getElementById('addCategoryForm');
if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const categories = Storage.get('menuCategories');
        const name = document.getElementById('addCategoryName').value.trim();

        if (!name) {
            alert('Please enter a category name');
            return;
        }

        if (editingCategoryId !== null) {
            // Edit existing category
            const index = categories.findIndex(c => c.id === editingCategoryId);
            if (index !== -1) {
                // Check if another category with the same name exists (excluding current one)
                const existingCategory = categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategoryId);
                if (existingCategory) {
                    alert('Category already exists!');
                    return;
                }
                categories[index].name = name;
            }
            editingCategoryId = null;
        } else {
            // Add new category
            // Check if category already exists
            const existingCategory = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
            if (existingCategory) {
                alert('Category already exists!');
                return;
            }

            const newCategory = {
                id: Date.now(),
                name: name
            };
            categories.push(newCategory);
        }

        Storage.set('menuCategories', categories);
        closeAddCategoryModal();
        loadMenuCategories();
        loadMenuItemsList();
        updateCategoryDropdowns();
        if (document.getElementById('pos')?.classList.contains('active')) {
            loadCategories();
            loadMenuItems();
        }
    });
}

function loadMenuCategories() {
    const categories = Storage.get('menuCategories');
    const container = document.getElementById('categoryTableBody');
    if (!container) return;

    container.innerHTML = '';

    // Color palette with unique colors for categories
    const colorPalette = [
        '#34495e',  // Dark blue-grey
        '#3498db',  // Blue
        '#27ae60',  // Green
        '#8e44ad',  // Purple
        '#e67e22',   // Orange
        '#16a085',  // Teal
        '#e74c3c',   // Red
        '#f39c12',  // Yellow-orange
        '#1abc9c', // Turquoise
        '#9b59b6',  // Violet
        '#34495e',  // Dark slate
        '#2ecc71',  // Emerald
        '#e91e63',   // Pink
        '#00bcd4',  // Cyan
        '#ff9800',  // Deep orange
        '#795548'   // Brown
    ];

    categories.forEach((category, index) => {
        const menuItems = Storage.get('menuItems');
        const itemCount = menuItems.filter(item => {
            // Ensure both are numbers for comparison
            const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
            const catId = typeof category.id === 'number' ? category.id : parseInt(category.id);
            return itemCategoryId === catId;
        }).length;

        const categoryBtn = document.createElement('div');
        categoryBtn.className = 'category-item-btn';
        // Assign unique color based on index, cycling through palette if needed
        const colorIndex = index % colorPalette.length;
        categoryBtn.style.background = colorPalette[colorIndex];
        categoryBtn.innerHTML = `
            <span class="category-item-name">${category.name}</span>
            <span class="category-item-count">(${itemCount})</span>
            <div class="category-item-actions">
                <button class="btn-edit-small" onclick="editCategory(${category.id})" title="Edit">✏️</button>
                <button class="btn-delete-small" onclick="deleteCategory(${category.id}, this)" title="Delete">🗑️</button>
            </div>
        `;
        container.appendChild(categoryBtn);
    });
}

window.editCategory = (id) => {
    const categories = Storage.get('menuCategories');
    const category = categories.find(c => c.id === id);
    if (category) {
        editingCategoryId = id;
        const modal = document.getElementById('addCategoryModal');
        const modalTitle = document.getElementById('categoryModalTitle');
        const submitBtn = document.getElementById('addCategorySubmitBtn');
        if (modal && modalTitle && submitBtn) {
            modalTitle.textContent = 'Categories';
            submitBtn.textContent = 'Update Category';
            document.getElementById('addCategoryName').value = category.name;
            modal.style.display = 'flex';
        }
    }
};

window.deleteCategory = (id, buttonElement) => {
    if (buttonElement) {
        showDeleteConfirmation(buttonElement, deleteCategoryConfirmed, id);
        return;
    }
    deleteCategoryConfirmed(id);
};

function deleteCategoryConfirmed(id) {
    const categories = Storage.get('menuCategories');
    const filtered = categories.filter(c => c.id !== id);
    Storage.set('menuCategories', filtered);

    // Also delete all items in this category
    const menuItems = Storage.get('menuItems');
    const filteredItems = menuItems.filter(item => item.categoryId !== id);
    Storage.set('menuItems', filteredItems);

    loadMenuCategories();
    loadMenuItemsList();
    updateCategoryDropdowns();
}

// Menu Item Management
let editingMenuItemId = null;

window.openAddMenuItemModal = () => {
    const modal = document.getElementById('addMenuItemModal');
    if (!modal) return;

    // Update category dropdown
    const categorySelect = document.getElementById('addMenuItemCategory');
    if (categorySelect) {
        const categories = Storage.get('menuCategories') || [];
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            categorySelect.appendChild(option);
        });
    }

    // Reset form
    document.getElementById('addMenuItemForm').reset();
    clearMenuItemImage();

    // Add image preview handler
    const imageInput = document.getElementById('addMenuItemImage');
    if (imageInput) {
        imageInput.onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const preview = document.getElementById('addMenuItemImagePreview');
                    const previewImg = document.getElementById('addMenuItemImagePreviewImg');
                    if (preview && previewImg) {
                        previewImg.src = event.target.result;
                        preview.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        };
    }

    checkAddNextItemButton();
    modal.style.display = 'flex';
};

// Function to clear menu item image
window.clearMenuItemImage = () => {
    const imageInput = document.getElementById('addMenuItemImage');
    const preview = document.getElementById('addMenuItemImagePreview');
    const previewImg = document.getElementById('addMenuItemImagePreviewImg');
    if (imageInput) imageInput.value = '';
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
};

// Function to convert image file to base64
function convertImageToBase64(file, callback) {
    if (!file) {
        callback(null);
        return;
    }

    // Compress and resize image for better performance
    const maxWidth = 300;
    const maxHeight = 300;
    const quality = 0.6;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to base64 with compression
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            callback(compressedDataUrl);
        };
        img.onerror = function () {
            callback(null);
        };
        img.src = event.target.result;
    };
    reader.onerror = function () {
        callback(null);
    };
    reader.readAsDataURL(file);
}

// Function to check if all fields are filled and enable/disable "Add Next Item" button
function checkAddNextItemButton() {
    const addNextItemBtn = document.getElementById('addNextItemBtn');
    if (!addNextItemBtn) return;

    const categoryId = document.getElementById('addMenuItemCategory')?.value;
    const name = document.getElementById('addMenuItemName')?.value.trim();
    const price = document.getElementById('addMenuItemPrice')?.value;

    const allFieldsFilled = categoryId && name && price && parseInt(price) > 0;

    if (allFieldsFilled) {
        addNextItemBtn.disabled = false;
        addNextItemBtn.style.background = '#4caf50';
        addNextItemBtn.style.cursor = 'pointer';
        addNextItemBtn.style.opacity = '1';
    } else {
        addNextItemBtn.disabled = true;
        addNextItemBtn.style.background = '#9e9e9e';
        addNextItemBtn.style.cursor = 'not-allowed';
        addNextItemBtn.style.opacity = '0.6';
    }
}

// Function to add item and reset fields for next item
window.addNextMenuItem = () => {
    const menuItems = Storage.get('menuItems') || [];
    const categoryIdValue = document.getElementById('addMenuItemCategory').value;
    const categoryId = categoryIdValue ? parseInt(categoryIdValue) : null;
    const name = document.getElementById('addMenuItemName').value.trim();
    const price = parseInt(document.getElementById('addMenuItemPrice').value);
    const imageFile = document.getElementById('addMenuItemImage')?.files[0];

    if (!categoryId) {
        alert('Please select a category');
        return;
    }

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    if (!price || price < 0) {
        alert('Please enter a valid price');
        return;
    }

    // Convert image to base64
    convertImageToBase64(imageFile, (imageData) => {
        const newItem = {
            id: Date.now(),
            categoryId: categoryId,
            name,
            price,
            image: imageData || null
        };
        menuItems.push(newItem);

        // Add new item to the order for its category
        const itemOrder = Storage.get('menuItemOrder') || {};
        const categoryKey = categoryId.toString();
        if (!itemOrder[categoryKey]) {
            itemOrder[categoryKey] = [];
        }
        itemOrder[categoryKey].push(newItem.id);

        // Also add to 'all' category order if it exists
        if (itemOrder['all']) {
            itemOrder['all'].push(newItem.id);
        }

        Storage.set('menuItemOrder', itemOrder);
        Storage.set('menuItems', menuItems);

        // Automatically create stock item for the new menu item
        createStockItemForMenuItem(newItem.name);

        // Reset fields but keep category and modal open
        const savedCategory = categoryId.toString();
        document.getElementById('addMenuItemName').value = '';
        document.getElementById('addMenuItemPrice').value = '';
        document.getElementById('addMenuItemCategory').value = savedCategory;
        clearMenuItemImage();
        checkAddNextItemButton();

        // Refresh the lists
        loadMenuItemsList();
        loadMenuCategories();
        updateCategoryDropdowns();
        if (document.getElementById('pos')?.classList.contains('active')) {
            loadCategories();
            loadMenuItems();
        }

        // Focus on item name field for quick entry
        document.getElementById('addMenuItemName').focus();
    });
};

window.closeAddMenuItemModal = () => {
    const modal = document.getElementById('addMenuItemModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addMenuItemForm').reset();
        clearMenuItemImage();
    }
};

window.openAddCategoryModal = () => {
    editingCategoryId = null;
    const modal = document.getElementById('addCategoryModal');
    const modalTitle = document.getElementById('categoryModalTitle');
    const submitBtn = document.getElementById('addCategorySubmitBtn');
    if (modal && modalTitle && submitBtn) {
        modalTitle.textContent = 'Categories';
        submitBtn.textContent = 'Add Category';
        document.getElementById('addCategoryForm').reset();
        modal.style.display = 'flex';
        // Load categories when modal opens
        loadMenuCategories();
    }
};

window.closeAddCategoryModal = () => {
    editingCategoryId = null;
    const modal = document.getElementById('addCategoryModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addCategoryForm').reset();
    }
};

// Add Menu Item Form handler
const addMenuItemForm = document.getElementById('addMenuItemForm');
if (addMenuItemForm) {
    addMenuItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const menuItems = Storage.get('menuItems') || [];
        const categoryIdValue = document.getElementById('addMenuItemCategory').value;
        const categoryId = categoryIdValue ? parseInt(categoryIdValue) : null;
        const name = document.getElementById('addMenuItemName').value.trim();
        const price = parseInt(document.getElementById('addMenuItemPrice').value);
        const imageFile = document.getElementById('addMenuItemImage')?.files[0];

        if (!categoryId) {
            alert('Please select a category');
            return;
        }

        if (!name) {
            alert('Please enter an item name');
            return;
        }

        if (!price || price < 0) {
            alert('Please enter a valid price');
            return;
        }

        // Convert image to base64
        convertImageToBase64(imageFile, (imageData) => {
            const newItem = {
                id: Date.now(),
                categoryId: categoryId,
                name,
                price,
                image: imageData || null
            };
            menuItems.push(newItem);

            // Add new item to the order for its category
            const itemOrder = Storage.get('menuItemOrder') || {};
            const categoryKey = categoryId.toString();
            if (!itemOrder[categoryKey]) {
                itemOrder[categoryKey] = [];
            }
            itemOrder[categoryKey].push(newItem.id);

            // Also add to 'all' category order if it exists
            if (itemOrder['all']) {
                itemOrder['all'].push(newItem.id);
            }

            Storage.set('menuItemOrder', itemOrder);
            Storage.set('menuItems', menuItems);

            // Automatically create stock item for the new menu item
            createStockItemForMenuItem(newItem.name);

            closeAddMenuItemModal();
            loadMenuItemsList();
            loadMenuCategories();
            updateCategoryDropdowns();
            if (document.getElementById('pos')?.classList.contains('active')) {
                loadCategories();
                loadMenuItems();
            }
        });
    });
}

window.loadMenuItemsList = function loadMenuItemsList() {
    const menuItems = Storage.get('menuItems');
    const categories = Storage.get('menuCategories');
    const filterValue = document.getElementById('menuItemFilter')?.value || 'all';
    const searchQuery = document.getElementById('menuItemSearch')?.value.trim().toLowerCase() || '';
    const sortFilter = document.getElementById('menuItemSortFilter')?.value || 'date-desc';

    let filteredItems = filterValue === 'all'
        ? menuItems
        : menuItems.filter(item => {
            // Ensure both are numbers for comparison
            const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
            const filterCatId = parseInt(filterValue);
            return itemCategoryId === filterCatId;
        });

    // Apply search filter
    if (searchQuery) {
        filteredItems = filteredItems.filter(item => {
            const itemName = item.name.toLowerCase();
            return itemName.includes(searchQuery);
        });
    }

    // Apply sorting
    filteredItems.sort((a, b) => {
        if (sortFilter === 'date-desc') {
            // Sort by ID descending (newest first, since ID is based on Date.now())
            return (b.id || 0) - (a.id || 0);
        } else if (sortFilter === 'date-asc') {
            // Sort by ID ascending (oldest first)
            return (a.id || 0) - (b.id || 0);
        } else if (sortFilter === 'name-asc') {
            return a.name.localeCompare(b.name);
        } else if (sortFilter === 'name-desc') {
            return b.name.localeCompare(a.name);
        } else if (sortFilter === 'price-asc') {
            return (a.price || 0) - (b.price || 0);
        } else if (sortFilter === 'price-desc') {
            return (b.price || 0) - (a.price || 0);
        } else if (sortFilter === 'category-asc' || sortFilter === 'category-desc') {
            // Get category names for comparison
            const aCategoryId = typeof a.categoryId === 'number' ? a.categoryId : parseInt(a.categoryId);
            const bCategoryId = typeof b.categoryId === 'number' ? b.categoryId : parseInt(b.categoryId);
            const aCategory = categories.find(c => {
                const catId = typeof c.id === 'number' ? c.id : parseInt(c.id);
                return catId === aCategoryId;
            });
            const bCategory = categories.find(c => {
                const catId = typeof c.id === 'number' ? c.id : parseInt(c.id);
                return catId === bCategoryId;
            });
            const aCategoryName = aCategory ? aCategory.name : '';
            const bCategoryName = bCategory ? bCategory.name : '';

            if (sortFilter === 'category-asc') {
                return aCategoryName.localeCompare(bCategoryName);
            } else {
                return bCategoryName.localeCompare(aCategoryName);
            }
        }
        return 0;
    });

    const tbody = document.getElementById('menuItemTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const countEl = document.getElementById('menuItemCount');
    if (countEl) countEl.textContent = 'Count: ' + filteredItems.length;

    const favorites = Storage.get('favorites') || [];

    filteredItems.forEach(item => {
        // Ensure type-safe comparison when finding category
        const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
        const category = categories.find(c => {
            const catId = typeof c.id === 'number' ? c.id : parseInt(c.id);
            return catId === itemCategoryId;
        });
        const isFavorite = favorites.includes(item.id);
        const tr = document.createElement('tr');
        tr.setAttribute('data-item-id', item.id);
        tr.innerHTML = `
            <td class="category-cell">${category ? category.name : 'N/A'}</td>
            <td class="name-cell">${item.name}</td>
            <td class="price-cell">Rs.${formatNumber(item.price)}</td>
            <td class="image-cell" style="text-align: center; padding: 8px;">
                ${item.image ? `<img src="${item.image}" alt="${item.name}" style="max-width: 60px; max-height: 60px; border-radius: 4px; border: 1px solid #e0e0e0; object-fit: cover;">` : '<span style="color: #999; font-size: 12px;">No image</span>'}
            </td>
            <td class="actions-cell" style="display: flex; gap: 8px; align-items: center; justify-content: flex-start; height: 100%;">
                <button class="btn-edit" onclick="editMenuItemInline(${item.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteMenuItem(${item.id}, this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
                ${isFavorite ?
                `<button class="btn-favorite btn-favorite-remove" onclick="removeFromFavorites(${item.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Remove from Favourites">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>` :
                `<button class="btn-favorite btn-favorite-add" onclick="addToFavorites(${item.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Move to Favourites">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>`
            }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.editMenuItemInline = (id) => {
    // Require password before editing
    openActionPasswordModal(() => {
        const menuItems = Storage.get('menuItems');
        const categories = Storage.get('menuCategories');
        const item = menuItems.find(i => i.id === id);
        if (!item) return;

        const tr = document.querySelector(`tr[data-item-id="${id}"]`);
        if (!tr) return;

        editMenuItemInlineInternal(id, item, categories, tr);
    });
};

function editMenuItemInlineInternal(id, item, categories, tr) {

    // Get current values
    const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
    const currentCategory = categories.find(c => {
        const catId = typeof c.id === 'number' ? c.id : parseInt(c.id);
        return catId === itemCategoryId;
    });

    // Create category dropdown
    let categoryOptions = '<option value="">Select Category</option>';
    categories.forEach(cat => {
        const selected = (typeof cat.id === 'number' ? cat.id : parseInt(cat.id)) === itemCategoryId ? 'selected' : '';
        categoryOptions += `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
    });

    // Replace cells with editable inputs
    tr.innerHTML = `
        <td class="category-cell">
            <select class="inline-edit-category" style="width: 100%; padding: 6px; border: 2px solid #4a90e2; border-radius: 4px; font-size: 14px;">
                ${categoryOptions}
            </select>
        </td>
        <td class="name-cell">
            <input type="text" class="inline-edit-name" value="${item.name}" style="width: 100%; padding: 6px; border: 2px solid #4a90e2; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </td>
        <td class="price-cell">
            <input type="number" class="inline-edit-price" value="${item.price}" step="1" min="0" style="width: 100%; padding: 6px; border: 2px solid #4a90e2; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </td>
        <td class="image-cell" style="vertical-align: top; padding: 8px;">
            <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start;">
                ${item.image ? `
                    <div style="margin-bottom: 4px;">
                        <img src="${item.image}" alt="Current image" style="max-width: 80px; max-height: 80px; border-radius: 4px; border: 2px solid #e0e0e0; object-fit: cover;">
                    </div>
                ` : '<div style="color: #999; font-size: 12px; margin-bottom: 4px;">No image</div>'}
                <input type="file" class="inline-edit-image" accept="image/*" style="font-size: 12px; padding: 4px;">
                ${item.image ? `<button type="button" class="inline-edit-remove-image" onclick="removeImageFromEdit(${id})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; margin-top: 4px;">Remove Image</button>` : ''}
            </div>
        </td>
        <td class="actions-cell">
            <button class="btn-save" onclick="saveMenuItemInline(${id})" style="background: #4caf50; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-family: 'Poppins', 'Inter', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.1px;">Save</button>
            <button class="btn-cancel" onclick="cancelMenuItemInline(${id})" style="background: #9e9e9e; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-family: 'Poppins', 'Inter', sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.1px;">Cancel</button>
        </td>
    `;

    // Add image preview handler
    const imageInput = tr.querySelector('.inline-edit-image');
    if (imageInput) {
        imageInput.onchange = function (e) {
            const file = e.target.files[0];
            if (file) {
                // Clear remove image flag if a new image is selected
                delete tr.dataset.removeImage;

                const reader = new FileReader();
                reader.onload = function (event) {
                    // Update the preview image if it exists, or create a new preview
                    const imageCell = tr.querySelector('.image-cell');
                    const existingPreview = imageCell.querySelector('img');
                    if (existingPreview) {
                        existingPreview.src = event.target.result;
                    } else {
                        const noImageDiv = imageCell.querySelector('div[style*="No image"]');
                        if (noImageDiv) {
                            noImageDiv.innerHTML = `<img src="${event.target.result}" alt="Preview" style="max-width: 80px; max-height: 80px; border-radius: 4px; border: 2px solid #e0e0e0; object-fit: cover;">`;
                        }
                    }
                    // Show remove button if not already shown
                    if (!imageCell.querySelector('.inline-edit-remove-image')) {
                        const removeBtn = document.createElement('button');
                        removeBtn.type = 'button';
                        removeBtn.className = 'inline-edit-remove-image';
                        removeBtn.onclick = () => removeImageFromEdit(id);
                        removeBtn.textContent = 'Remove Image';
                        removeBtn.style.cssText = 'background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; margin-top: 4px;';
                        imageCell.querySelector('div').appendChild(removeBtn);
                    }
                };
                reader.readAsDataURL(file);
            }
        };
    }
};

window.removeImageFromEdit = (id) => {
    const tr = document.querySelector(`tr[data-item-id="${id}"]`);
    if (!tr) return;

    // Set flag to remove image when saving
    tr.dataset.removeImage = 'true';

    // Update the UI to show "No image"
    const imageCell = tr.querySelector('.image-cell');
    if (imageCell) {
        const div = imageCell.querySelector('div');
        if (div) {
            // Remove existing image preview
            const img = div.querySelector('img');
            if (img) {
                img.remove();
            }

            // Show "No image" text
            const noImageDiv = div.querySelector('div[style*="No image"]');
            if (!noImageDiv) {
                const noImageText = document.createElement('div');
                noImageText.style.cssText = 'color: #999; font-size: 12px; margin-bottom: 4px;';
                noImageText.textContent = 'No image';
                div.insertBefore(noImageText, div.firstChild);
            }

            // Remove the remove button
            const removeBtn = div.querySelector('.inline-edit-remove-image');
            if (removeBtn) {
                removeBtn.remove();
            }

            // Clear the file input
            const imageInput = div.querySelector('.inline-edit-image');
            if (imageInput) {
                imageInput.value = '';
            }
        }
    }
};

window.saveMenuItemInline = (id) => {
    const menuItems = Storage.get('menuItems');
    const item = menuItems.find(i => i.id === id);
    if (!item) return;

    const tr = document.querySelector(`tr[data-item-id="${id}"]`);
    if (!tr) return;

    const categorySelect = tr.querySelector('.inline-edit-category');
    const nameInput = tr.querySelector('.inline-edit-name');
    const priceInput = tr.querySelector('.inline-edit-price');
    const imageInput = tr.querySelector('.inline-edit-image');
    const imageFile = imageInput?.files[0];

    const newCategoryId = parseInt(categorySelect.value);
    const newName = nameInput.value.trim();
    const newPrice = parseInt(priceInput.value);

    if (!newCategoryId) {
        alert('Please select a category');
        return;
    }

    if (!newName) {
        alert('Please enter an item name');
        return;
    }

    if (!newPrice || newPrice < 0) {
        alert('Please enter a valid price');
        return;
    }

    // Check if image should be removed
    const shouldRemoveImage = tr.dataset.removeImage === 'true';

    // Convert new image to base64 if provided
    if (imageFile) {
        convertImageToBase64(imageFile, (imageData) => {
            updateMenuItemWithImage(id, newCategoryId, newName, newPrice, imageData, shouldRemoveImage);
        });
    } else {
        // No new image, but check if we should remove existing one
        const newImageData = shouldRemoveImage ? null : (item.image || null);
        updateMenuItemWithImage(id, newCategoryId, newName, newPrice, newImageData, false);
    }
};

// Helper function to update menu item with image
function updateMenuItemWithImage(id, newCategoryId, newName, newPrice, imageData, shouldRemoveImage) {
    const menuItems = Storage.get('menuItems');
    const index = menuItems.findIndex(i => i.id === id);
    if (index !== -1) {
        const oldItem = menuItems[index];
        const oldName = oldItem.name;
        const oldPrice = oldItem.price;
        // Use new image data if provided, otherwise keep existing (unless removing)
        const finalImage = shouldRemoveImage ? null : (imageData !== undefined ? imageData : (oldItem.image || null));
        menuItems[index] = { id: id, categoryId: newCategoryId, name: newName, price: newPrice, image: finalImage };

        // If category changed, update the order
        if (oldItem.categoryId !== newCategoryId) {
            const itemOrder = Storage.get('menuItemOrder') || {};
            const oldCategoryKey = oldItem.categoryId.toString();
            const newCategoryKey = newCategoryId.toString();

            // Remove from old category order
            if (itemOrder[oldCategoryKey]) {
                itemOrder[oldCategoryKey] = itemOrder[oldCategoryKey].filter(itemId => itemId !== id);
            }

            // Add to new category order
            if (!itemOrder[newCategoryKey]) {
                itemOrder[newCategoryKey] = [];
            }
            if (!itemOrder[newCategoryKey].includes(id)) {
                itemOrder[newCategoryKey].push(id);
            }

            Storage.set('menuItemOrder', itemOrder);
        }

        // Update item name and price in hold orders
        if (oldName !== newName || oldPrice !== newPrice) {
            const holdOrders = Storage.get('holdOrders') || [];
            holdOrders.forEach(order => {
                if (order.items && Array.isArray(order.items)) {
                    order.items.forEach(item => {
                        if (item.id === id) {
                            item.name = newName;
                            item.price = newPrice;
                            // Recalculate total if price changed
                            if (oldPrice !== newPrice) {
                                item.total = newPrice * (item.quantity || 1);
                            }
                        }
                    });
                    // Recalculate order totals if price changed
                    if (oldPrice !== newPrice) {
                        order.subtotal = order.items.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0);
                        order.tax = 0;
                        order.total = order.subtotal;
                    }
                }
            });
            Storage.set('holdOrders', holdOrders);
        }

        // Update item name and price in sales
        if (oldName !== newName || oldPrice !== newPrice) {
            const sales = Storage.get('sales') || [];
            sales.forEach(sale => {
                if (sale.items && Array.isArray(sale.items)) {
                    let saleUpdated = false;
                    sale.items.forEach(item => {
                        // Match by ID if available, otherwise match by name (for backward compatibility)
                        if ((item.id === id) || (!item.id && item.name === oldName)) {
                            item.name = newName;
                            item.price = newPrice;
                            // Add ID if missing for future updates
                            if (!item.id) {
                                item.id = id;
                            }
                            // Recalculate total if price changed
                            if (oldPrice !== newPrice) {
                                item.total = newPrice * (item.quantity || 1);
                                saleUpdated = true;
                            }
                        }
                    });
                    // Recalculate sale totals if price changed
                    if (saleUpdated) {
                        sale.subtotal = sale.items.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0);
                        sale.tax = 0;
                        sale.total = sale.subtotal;
                    }
                }
            });
            Storage.set('sales', sales);
        }

        // Update item name and price in current cart
        if (oldName !== newName || oldPrice !== newPrice) {
            cart.forEach(cartItem => {
                if (cartItem.id === id) {
                    cartItem.name = newName;
                    cartItem.price = newPrice;
                }
            });
            updateCart();
        }

        // Update stock item name if menu item name changed
        if (oldName !== newName) {
            const stocks = Storage.get('stocks') || [];
            const stockItem = stocks.find(s => s.itemName && s.itemName.toLowerCase() === oldName.toLowerCase());
            if (stockItem) {
                stockItem.itemName = newName;
                stockItem.updatedAt = new Date().toISOString();
                Storage.set('stocks', stocks);

                // Refresh stock list if on stock tab
                if (document.getElementById('stock')?.classList.contains('active')) {
                    loadStock();
                }
            }
        }

        // Update stock item price if menu item price changed
        if (oldPrice !== newPrice) {
            const stocks = Storage.get('stocks') || [];
            // Find stock item by current name (could be oldName or newName if name also changed)
            const stockItem = stocks.find(s => {
                const stockName = s.itemName ? s.itemName.toLowerCase() : '';
                return stockName === oldName.toLowerCase() || stockName === newName.toLowerCase();
            });
            if (stockItem) {
                stockItem.unitPrice = newPrice;
                stockItem.updatedAt = new Date().toISOString();
                Storage.set('stocks', stocks);

                // Refresh stock list if on stock tab
                if (document.getElementById('stock')?.classList.contains('active')) {
                    loadStock();
                }
            }
        }
    }

    Storage.set('menuItems', menuItems);
    loadMenuItemsList();
    loadMenuCategories();
    updateCategoryDropdowns();

    // Refresh views if they're active
    if (document.getElementById('pos')?.classList.contains('active')) {
        loadCategories();
        loadMenuItems();
    }
    if (document.getElementById('holdOrders')?.classList.contains('active')) {
        loadHoldOrders();
    }
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }
};

window.cancelMenuItemInline = (id) => {
    // Clear any image removal flag
    const tr = document.querySelector(`tr[data-item-id="${id}"]`);
    if (tr) {
        delete tr.dataset.removeImage;
    }
    loadMenuItemsList();
};

// Keep old function for backward compatibility but make it call inline version
window.editMenuItem = (id) => {
    editMenuItemInline(id);
};

window.deleteMenuItem = (id, buttonElement) => {
    // Require password before deletion
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement) {
            // Try to find the button in the DOM
            const tr = document.querySelector(`tr[data-item-id="${id}"]`);
            if (tr) {
                btnElement = tr.querySelector('.btn-delete');
            }
        }

        if (btnElement && btnElement.parentElement) {
            showDeleteConfirmation(btnElement, deleteMenuItemConfirmed, id);
        } else {
            // If button not found, directly delete
            deleteMenuItemConfirmed(id);
        }
    });
};

function deleteMenuItemConfirmed(id) {
    const menuItems = Storage.get('menuItems');
    const itemToDelete = menuItems.find(item => item.id === id);
    const filtered = menuItems.filter(item => item.id !== id);
    Storage.set('menuItems', filtered);

    // Remove item from all category orders
    if (itemToDelete) {
        const itemOrder = Storage.get('menuItemOrder') || {};
        const categoryKey = itemToDelete.categoryId.toString();

        // Remove from specific category order
        if (itemOrder[categoryKey]) {
            itemOrder[categoryKey] = itemOrder[categoryKey].filter(itemId => itemId !== id);
        }

        // Remove from 'all' category order
        if (itemOrder['all']) {
            itemOrder['all'] = itemOrder['all'].filter(itemId => itemId !== id);
        }

        // Delete corresponding stock item if it exists
        const itemName = itemToDelete.name || itemToDelete.dishName;
        if (itemName) {
            const stocks = Storage.get('stocks') || [];
            const filteredStocks = stocks.filter(s => {
                // Case-insensitive comparison
                const stockItemName = s.itemName ? s.itemName.toLowerCase() : '';
                const menuItemName = itemName.toLowerCase();
                return stockItemName !== menuItemName;
            });
            Storage.set('stocks', filteredStocks);

            // Refresh stock list if on stock tab
            if (document.getElementById('stock')?.classList.contains('active')) {
                loadStock();
            }
        }

        Storage.set('menuItemOrder', itemOrder);
    }

    loadMenuItemsList();
    loadMenuCategories();
    updateCategoryDropdowns();
    if (document.getElementById('pos')?.classList.contains('active')) {
        loadCategories();
        loadMenuItems();
    }
}

function updateCategoryDropdowns() {
    const categories = Storage.get('menuCategories');

    // Update menu item filter dropdown
    const filterSelect = document.getElementById('menuItemFilter');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            filterSelect.appendChild(option);
        });
        filterSelect.value = currentValue;
    }
}

// Filter change handler
const menuItemFilter = document.getElementById('menuItemFilter');
if (menuItemFilter) {
    menuItemFilter.addEventListener('change', loadMenuItemsList);
}

// Sort change handler
const menuItemSortFilter = document.getElementById('menuItemSortFilter');
if (menuItemSortFilter) {
    menuItemSortFilter.addEventListener('change', loadMenuItemsList);
}

// Search functionality
window.searchMenuItems = () => {
    loadMenuItemsList();
};

// Sales Management - Form removed, only displaying sales history

window.loadSales = function loadSales() {
    const sales = Storage.get('sales') || [];
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get filter values
    const dateFilter = document.getElementById('salesDateFilter')?.value || 'all';
    const paymentFilter = document.getElementById('salesPaymentFilter')?.value || 'all';
    const sortFilter = document.getElementById('salesSortFilter')?.value || 'date-desc';

    // Populate tables filter dropdown
    const tableFilterSelect = document.getElementById('salesTableFilter');
    let tableFilter = 'all';
    if (tableFilterSelect) {
        tableFilter = tableFilterSelect.value || 'all';
        const tables = Storage.get('tables') || [];
        tableFilterSelect.innerHTML = '<option value="all">All Tables</option>';
        // Sort tables by number
        tables.sort((a, b) => a.number - b.number).forEach(t => {
            const option = document.createElement('option');
            option.value = String(t.number);
            option.textContent = `Table ${t.number}`;
            tableFilterSelect.appendChild(option);
        });
        tableFilterSelect.value = tableFilter;
    }

    // Group sales by orderId if they have one, otherwise group by date/time for old sales
    const orderMap = {};
    const ungroupedSales = [];

    // First pass: separate grouped orders from individual items
    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            // Already grouped as order
            const orderId = sale.orderId || sale.id;
            orderMap[orderId] = sale;
        } else {
            // Individual item (old format)
            ungroupedSales.push(sale);
        }
    });

    // Group ungrouped sales by date/time (within 5 seconds) and payment method
    const groupedByTime = {};
    ungroupedSales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const timeKey = Math.floor(saleDate.getTime() / 5000) * 5000; // Group by 5-second intervals
        const groupKey = `${timeKey}-${(sale.paymentMethod || 'cash')}`;

        if (!groupedByTime[groupKey]) {
            groupedByTime[groupKey] = {
                id: `ORD-${timeKey}`,
                orderId: `ORD-${timeKey}`,
                date: sale.date,
                paymentMethod: sale.paymentMethod || 'cash',
                items: [],
                total: 0,
                subtotal: 0,
                tax: 0
            };
        }

        groupedByTime[groupKey].items.push({
            name: sale.itemName || sale.dishName || 'Unknown',
            quantity: sale.quantity,
            price: sale.price,
            total: sale.total
        });
        groupedByTime[groupKey].total += sale.total;
        groupedByTime[groupKey].subtotal += sale.total;
    });

    // Calculate tax for grouped orders
    Object.values(groupedByTime).forEach(order => {
        order.tax = 0;
        order.total = order.subtotal;
        orderMap[order.orderId] = order;
    });

    // Convert to array
    let orders = Object.values(orderMap);

    // Apply date filter
    if (dateFilter !== 'all') {
        orders = orders.filter(order => {
            if (!order.date) return false;
            const orderDate = new Date(order.date);
            let matchesDate = false;

            if (dateFilter === 'custom') {
                const startDate = document.getElementById('salesStartDate')?.value;
                const endDate = document.getElementById('salesEndDate')?.value;

                if (startDate || endDate) {
                    matchesDate = true;
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (orderDate < start) matchesDate = false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        if (orderDate > end) matchesDate = false;
                    }
                } else {
                    matchesDate = false;
                }
            } else {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                today.setHours(0, 0, 0, 0);
                const todayEnd = new Date(today);
                todayEnd.setHours(23, 59, 59, 999);

                if (dateFilter === 'today') {
                    matchesDate = orderDate >= today && orderDate <= todayEnd;
                } else if (dateFilter === 'week') {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    matchesDate = orderDate >= weekAgo && orderDate <= todayEnd;
                } else if (dateFilter === 'month') {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    matchesDate = orderDate >= monthAgo && orderDate <= todayEnd;
                } else if (dateFilter === 'specific-month') {
                    const selectedMonth = document.getElementById('salesMonthFilter')?.value;
                    if (selectedMonth) {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        matchesDate = orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month;
                    } else {
                        matchesDate = true;
                    }
                }
            }

            return matchesDate;
        });
    }

    // Apply payment method filter
    if (paymentFilter !== 'all') {
        orders = orders.filter(order => {
            const method = (order.paymentMethod || 'cash').toLowerCase().trim();
            const filterValue = paymentFilter.toLowerCase().trim();
            const matches = method === filterValue;
            return matches;
        });
    }

    // Apply table filter
    if (tableFilter !== 'all') {
        orders = orders.filter(order => String(order.tableNo) === tableFilter);
    }

    // Apply sorting
    if (sortFilter === 'date-desc') {
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortFilter === 'date-asc') {
        orders.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sortFilter === 'amount-desc') {
        orders.sort((a, b) => (b.total || 0) - (a.total || 0));
    } else if (sortFilter === 'amount-asc') {
        orders.sort((a, b) => (a.total || 0) - (b.total || 0));
    }

    orders.forEach(order => {
        const tr = document.createElement('tr');
        const orderDate = new Date(order.date);
        const dateStr = formatDate(orderDate);
        const timeStr = formatTime(orderDate);

        // Use orderId if available, otherwise use id
        const orderIdentifier = order.orderId || order.id;
        const displayOrderNumber = (order.orderNumber || extractOrderNumber(orderIdentifier) || '').toString().padStart(7, '0');
        let paymentMethod = formatLocation(order.paymentMethod);
        if (order.tableNo) {
            paymentMethod += ` (T ${order.tableNo})`;
        }

        const waiterName = order.waiter ? escapeHtml(order.waiter) : '-';
        const customerName = order.customerName ? escapeHtml(order.customerName) : '-';
        tr.innerHTML = `
            <td>#${displayOrderNumber}</td>
            <td>${dateStr} ${timeStr}</td>
            <td>${paymentMethod}</td>
            <td>${customerName}</td>
            <td>${waiterName}</td>
            <td>Rs.${formatNumber(order.total || 0)}</td>
            <td>
                <button class="btn-view" onclick="viewSale('${orderIdentifier}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="View Sale">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button class="btn-view" onclick="printReceiptForSale('${orderIdentifier}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Print Receipt">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                </button>
                <button class="btn-delete" onclick="deleteSale('${orderIdentifier}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update summary (based on filtered orders)
    const totalOrders = orders.length;

    const countEl = document.getElementById('salesCount');
    if (countEl) countEl.textContent = 'Count: ' + orders.length;

    // Calculate today's sales from filtered orders
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= today && orderDate <= todayEnd;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

    // Calculate this week's sales (Monday to Sunday)
    const currentDay = now.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert Sunday (0) to 6
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekSales = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= weekStart && orderDate <= weekEnd;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

    // Calculate this month's sales
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const monthSales = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);

    // Calculate average order price (based on filtered orders)
    const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const averageOrderPrice = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Calculate today's tax
    const todayTax = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= today && orderDate <= todayEnd;
        })
        .reduce((sum, o) => {
            // Exclude tax for Parcel/Delivery orders
            const paymentMethod = o.paymentMethod || 'cash';
            if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
                return sum; // No tax for parcel orders
            }
            // Use order.tax if available, otherwise calculate from subtotal
            if (o.tax) {
                return sum + o.tax;
            } else if (o.subtotal) {
                // Calculate tax from subtotal (5% of subtotal after discount)
                const discountAmount = o.discount && o.discount.amount ? o.discount.amount : 0;
                const discountedSubtotal = Math.max(0, o.subtotal - discountAmount);
                return sum + (discountedSubtotal * SALES_TAX_RATE);
            } else {
                // Fallback: estimate tax from total (assuming total includes tax)
                // If total is 105, subtotal is ~100, tax is ~5
                return sum + (o.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
            }
        }, 0);

    // Calculate weekly tax
    const weeklyTax = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= weekStart && orderDate <= weekEnd;
        })
        .reduce((sum, o) => {
            // Exclude tax for Parcel/Delivery orders
            const paymentMethod = o.paymentMethod || 'cash';
            if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
                return sum; // No tax for parcel orders
            }
            // Use order.tax if available, otherwise calculate from subtotal
            if (o.tax) {
                return sum + o.tax;
            } else if (o.subtotal) {
                // Calculate tax from subtotal (5% of subtotal after discount)
                const discountAmount = o.discount && o.discount.amount ? o.discount.amount : 0;
                const discountedSubtotal = Math.max(0, o.subtotal - discountAmount);
                return sum + (discountedSubtotal * SALES_TAX_RATE);
            } else {
                // Fallback: estimate tax from total (assuming total includes tax)
                return sum + (o.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
            }
        }, 0);

    // Calculate monthly tax
    const monthlyTax = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum, o) => {
            // Exclude tax for Parcel/Delivery orders
            const paymentMethod = o.paymentMethod || 'cash';
            if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
                return sum; // No tax for parcel orders
            }
            // Use order.tax if available, otherwise calculate from subtotal
            if (o.tax) {
                return sum + o.tax;
            } else if (o.subtotal) {
                // Calculate tax from subtotal (5% of subtotal after discount)
                const discountAmount = o.discount && o.discount.amount ? o.discount.amount : 0;
                const discountedSubtotal = Math.max(0, o.subtotal - discountAmount);
                return sum + (discountedSubtotal * SALES_TAX_RATE);
            } else {
                // Fallback: estimate tax from total (assuming total includes tax)
                return sum + (o.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
            }
        }, 0);

    // Calculate annual tax
    const yearStart = new Date(now.getFullYear(), 0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const yearEnd = new Date(now.getFullYear(), 11, 31);
    yearEnd.setHours(23, 59, 59, 999);

    const annualTax = orders
        .filter(o => {
            if (!o.date) return false;
            const orderDate = new Date(o.date);
            return orderDate >= yearStart && orderDate <= yearEnd;
        })
        .reduce((sum, o) => {
            // Exclude tax for Parcel/Delivery orders
            const paymentMethod = o.paymentMethod || 'cash';
            if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
                return sum; // No tax for parcel orders
            }
            // Use order.tax if available, otherwise calculate from subtotal
            if (o.tax) {
                return sum + o.tax;
            } else if (o.subtotal) {
                // Calculate tax from subtotal (5% of subtotal after discount)
                const discountAmount = o.discount && o.discount.amount ? o.discount.amount : 0;
                const discountedSubtotal = Math.max(0, o.subtotal - discountAmount);
                return sum + (discountedSubtotal * SALES_TAX_RATE);
            } else {
                // Fallback: estimate tax from total (assuming total includes tax)
                return sum + (o.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
            }
        }, 0);

    const totalOrdersEl = document.getElementById('totalOrders');
    const todaySalesEl = document.getElementById('todaySales');
    const weekSalesEl = document.getElementById('weekSales');
    const monthSalesEl = document.getElementById('monthSales');
    const averageOrderPriceEl = document.getElementById('averageOrderPrice');
    const taxTodayEl = document.getElementById('taxToday');
    const weeklyTaxEl = document.getElementById('weeklyTax');
    const monthlyTaxEl = document.getElementById('monthlyTax');
    const annualTaxEl = document.getElementById('annualTax');

    if (totalOrdersEl) totalOrdersEl.textContent = formatNumber(totalOrders);
    if (todaySalesEl) todaySalesEl.textContent = `Rs.${formatNumber(totalSales)}`;
    if (weekSalesEl) weekSalesEl.textContent = `Rs.${formatNumber(weekSales)}`;
    if (monthSalesEl) monthSalesEl.textContent = `Rs.${formatNumber(monthSales)}`;
    if (averageOrderPriceEl) averageOrderPriceEl.textContent = `Rs.${formatNumber(averageOrderPrice)}`;
    if (taxTodayEl) taxTodayEl.textContent = `Rs.${formatNumber(todayTax)}`;
    if (weeklyTaxEl) weeklyTaxEl.textContent = `Rs.${formatNumber(weeklyTax)}`;
    if (monthlyTaxEl) monthlyTaxEl.textContent = `Rs.${formatNumber(monthlyTax)}`;
    if (annualTaxEl) annualTaxEl.textContent = `Rs.${formatNumber(annualTax)}`;

    // Also update Tax History tab cards
    const taxTodayHistoryEl = document.getElementById('taxTodayHistory');
    const weeklyTaxHistoryEl = document.getElementById('weeklyTaxHistory');
    const monthlyTaxHistoryEl = document.getElementById('monthlyTaxHistory');
    const annualTaxHistoryEl = document.getElementById('annualTaxHistory');

    if (taxTodayHistoryEl) taxTodayHistoryEl.textContent = `Rs.${formatNumber(todayTax)}`;
    if (weeklyTaxHistoryEl) weeklyTaxHistoryEl.textContent = `Rs.${formatNumber(weeklyTax)}`;
    if (monthlyTaxHistoryEl) monthlyTaxHistoryEl.textContent = `Rs.${formatNumber(monthlyTax)}`;
    if (annualTaxHistoryEl) annualTaxHistoryEl.textContent = `Rs.${formatNumber(annualTax)}`;
}

window.loadTaxHistory = function loadTaxHistory() {
    const sales = Storage.get('sales') || [];
    const tbody = document.getElementById('taxHistoryTableBody');
    const filterSelect = document.getElementById('taxHistoryFilter');

    if (!tbody) return;

    const filter = filterSelect ? filterSelect.value : 'today';

    // Filter orders based on selected period
    let filteredSales = [...sales];
    const now = new Date();

    if (filter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= today && saleDate <= todayEnd;
        });
    } else if (filter === 'week') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= weekStart && saleDate <= weekEnd;
        });
    } else if (filter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= monthStart && saleDate <= monthEnd;
        });
    } else if (filter === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= yearStart && saleDate <= yearEnd;
        });
    } else if (filter === 'specific-month') {
        const selectedMonth = document.getElementById('taxHistoryMonthFilter')?.value;
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            filteredSales = sales.filter(sale => {
                if (!sale.date) return false;
                const saleDate = new Date(sale.date);
                return saleDate.getFullYear() === year && (saleDate.getMonth() + 1) === month;
            });
        }
    }
    // If filter === 'all', use all sales (filteredSales already contains all sales)

    // Sort by date (newest first)
    filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = '';

    const countEl = document.getElementById('taxHistoryCount');
    if (countEl) countEl.textContent = 'Count: ' + filteredSales.length;

    if (filteredSales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No orders found</td></tr>';
        return;
    }

    filteredSales.forEach(sale => {
        const tr = document.createElement('tr');
        const orderDate = sale.date ? new Date(sale.date) : new Date();
        const dateStr = formatDate(orderDate);
        const timeStr = formatTime(orderDate);
        const displayOrderNumber = (sale.orderNumber || extractOrderNumber(sale.orderId || sale.id) || '').toString().padStart(7, '0');

        // Calculate tax - exclude tax for Parcel/Delivery orders
        const paymentMethod = sale.paymentMethod || 'cash';
        const isParcelOrder = (paymentMethod === 'delivery' || paymentMethod === 'parcel');

        let taxAmount = 0;
        if (!isParcelOrder) {
            if (sale.tax) {
                taxAmount = sale.tax;
            } else if (sale.subtotal) {
                const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
                const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
                taxAmount = discountedSubtotal * SALES_TAX_RATE;
            } else {
                // Fallback: estimate tax from total
                taxAmount = (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
            }
        }

        const subtotal = sale.subtotal || 0;
        const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
        const total = sale.total || 0;

        tr.innerHTML = `
            <td>#${displayOrderNumber}</td>
            <td>${dateStr} ${timeStr}</td>
            <td>${formatLocation(sale.paymentMethod)}</td>
            <td>Rs.${formatNumber(subtotal)}</td>
            <td>${discountAmount > 0 ? `-Rs.${formatNumber(discountAmount)}` : 'Rs.0'}</td>
            <td>Rs.${formatNumber(taxAmount)}</td>
            <td>Rs.${formatNumber(total)}</td>
            <td>
                <button class="btn-view" onclick="printReceiptForSale('${sale.orderId || sale.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Print Receipt">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.printTaxHistory = () => {
    const sales = Storage.get('sales') || [];
    const printWindow = window.open('', '_blank');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    // Get filter value (same as loadTaxHistory)
    const filter = document.getElementById('taxHistoryFilter')?.value || 'today';

    // Filter orders based on selected period (same logic as loadTaxHistory)
    let filteredSales = [...sales];
    const nowFilter = new Date();

    if (filter === 'today') {
        const today = new Date(nowFilter.getFullYear(), nowFilter.getMonth(), nowFilter.getDate());
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= today && saleDate <= todayEnd;
        });
    } else if (filter === 'week') {
        const today = new Date(nowFilter.getFullYear(), nowFilter.getMonth(), nowFilter.getDate());
        today.setHours(0, 0, 0, 0);
        const currentDay = nowFilter.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= weekStart && saleDate <= weekEnd;
        });
    } else if (filter === 'month') {
        const monthStart = new Date(nowFilter.getFullYear(), nowFilter.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(nowFilter.getFullYear(), nowFilter.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= monthStart && saleDate <= monthEnd;
        });
    } else if (filter === 'year') {
        const yearStart = new Date(nowFilter.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearEnd = new Date(nowFilter.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= yearStart && saleDate <= yearEnd;
        });
    } else if (filter === 'specific-month') {
        const selectedMonth = document.getElementById('taxHistoryMonthFilter')?.value;
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            filteredSales = sales.filter(sale => {
                if (!sale.date) return false;
                const saleDate = new Date(sale.date);
                return saleDate.getFullYear() === year && (saleDate.getMonth() + 1) === month;
            });
        }
    }

    // Sort by date (newest first)
    filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get filter label
    let filterLabel = 'All Time';
    if (filter === 'today') filterLabel = 'Daily';
    else if (filter === 'week') filterLabel = 'Weekly';
    else if (filter === 'month') filterLabel = 'Monthly';
    else if (filter === 'year') filterLabel = 'Annual';
    else if (filter === 'specific-month') {
        const selectedMonth = document.getElementById('taxHistoryMonthFilter')?.value;
        filterLabel = selectedMonth ? `Month: ${selectedMonth}` : 'Specific Month';
    }

    // Build tax history table rows
    let taxRows = '';
    let totalTax = 0;
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalAmount = 0;

    if (filteredSales.length === 0) {
        taxRows = '<tr><td colspan="5" style="text-align: center; padding: 10px;">No tax data available</td></tr>';
    } else {
        filteredSales.forEach(sale => {
            const orderDate = sale.date ? new Date(sale.date) : new Date();
            const dateStr = formatDate(orderDate);
            const timeStr = formatTime(orderDate);
            const displayOrderNumber = (sale.orderNumber || extractOrderNumber(sale.orderId || sale.id) || '').toString().padStart(7, '0');

            // Calculate tax - exclude tax for Parcel/Delivery orders
            const paymentMethod = sale.paymentMethod || 'cash';
            const isParcelOrder = (paymentMethod === 'delivery' || paymentMethod === 'parcel');

            let taxAmount = 0;
            if (!isParcelOrder) {
                if (sale.tax) {
                    taxAmount = sale.tax;
                } else if (sale.subtotal) {
                    const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
                    const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
                    taxAmount = discountedSubtotal * SALES_TAX_RATE;
                } else {
                    taxAmount = (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
                }
            }

            const subtotal = sale.subtotal || 0;
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const total = sale.total || 0;

            totalTax += taxAmount;
            totalSubtotal += subtotal;
            totalDiscount += discountAmount;
            totalAmount += total;

            taxRows += `
                <tr>
                    <td style="text-align: left; padding: 1px 2px;">#${displayOrderNumber}</td>
                    <td style="text-align: left; padding: 1px 2px; font-size: 8px;">${dateStr}<br>${timeStr}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(subtotal)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(taxAmount)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(total)}</td>
                </tr>
            `;
        });
    }

    // Build summary row
    const summaryRow = `
        <tr style="border-top: 2px solid #000; font-weight: 700;">
            <td style="text-align: left; padding: 2px 2px;">TOTAL</td>
            <td style="text-align: left; padding: 2px 2px;">${filteredSales.length} Orders</td>
            <td style="text-align: right; padding: 2px 2px;">Rs.${formatNumber(totalSubtotal)}</td>
            <td style="text-align: right; padding: 2px 2px;">Rs.${formatNumber(totalTax)}</td>
            <td style="text-align: right; padding: 2px 2px;">Rs.${formatNumber(totalAmount)}</td>
        </tr>
    `;

    printWindow.document.write(`
        <html>
            <head>
                <title>Tax History Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 11px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 900;
                        margin-bottom: 4px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 8px 0;
                    }
                    .report-info {
                        font-size: 10px;
                        margin: 4px 0;
                        font-weight: 600;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                        font-size: 9px;
                    }
                    thead {
                        border-bottom: 2px solid #000;
                    }
                    th {
                        padding: 6px 2px;
                        text-align: left;
                        font-weight: 700;
                        font-size: 10px;
                    }
                    th:nth-child(3),
                    th:nth-child(4),
                    th:nth-child(5) {
                        text-align: right;
                    }
                    td {
                        padding: 2px 2px;
                        border-bottom: 1px dotted #ccc;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    td:nth-child(3),
                    td:nth-child(4),
                    td:nth-child(5) {
                        text-align: right;
                    }
                    .summary-section {
                        text-align: center;
                        margin-top: 8px;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                            max-width: 80mm;
                        }
                        .receipt-logo {
                            max-width: 80px;
                            max-height: 80px;
                            margin: 0 auto 6px auto;
                        }
                        table {
                            font-size: 9px;
                            border-spacing: 0;
                        }
                        th, td {
                            font-size: 9px;
                            padding: 1px 1px;
                            font-weight: 600 !important;
                            line-height: 1.2 !important;
                        }
                        .header-section, .report-info, .summary-section {
                            font-weight: 600 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="report-title">TAX HISTORY REPORT</div>
                    <div class="separator"></div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="report-info">Filter: ${filterLabel}</div>
                    <div class="separator"></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Subtotal</th>
                            <th>GST (5%)</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taxRows}
                        ${summaryRow}
                    </tbody>
                </table>
                <div class="summary-section">
                    <div class="separator"></div>
                    <div style="font-weight: 700; margin: 4px 0;">Total Tax: Rs.${formatNumber(totalTax)}</div>
                    <div style="margin: 4px 0;">Thank You!</div>
                    <div style="margin-top: 10px;"></div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

window.loadItemsSales = function loadItemsSales() {
    const sales = Storage.get('sales') || [];
    const tbody = document.getElementById('itemsSalesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get filter values
    const dateFilter = document.getElementById('itemsSalesDateFilter')?.value || 'all';
    const sortFilter = document.getElementById('itemsSalesSortFilter')?.value || 'quantity-desc';
    const searchTerm = (document.getElementById('itemsSalesSearch')?.value || '').toLowerCase().trim();

    // Filter sales by date range
    let filteredSales = [...sales];
    const now = new Date();

    if (dateFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= today && saleDate <= todayEnd;
        });
    } else if (dateFilter === 'week') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= weekStart && saleDate <= weekEnd;
        });
    } else if (dateFilter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= monthStart && saleDate <= monthEnd;
        });
    } else if (dateFilter === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= yearStart && saleDate <= yearEnd;
        });
    } else if (dateFilter === 'specific-month') {
        const selectedMonth = document.getElementById('itemsSalesMonthFilter')?.value;
        if (selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            filteredSales = sales.filter(sale => {
                if (!sale.date) return false;
                const saleDate = new Date(sale.date);
                return saleDate.getFullYear() === year && (saleDate.getMonth() + 1) === month;
            });
        }
    }
    // If dateFilter === 'all', use all sales (filteredSales already contains all sales)

    // Aggregate items from filtered sales
    const itemMap = {};

    filteredSales.forEach(sale => {

        // Process items from this sale
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const itemName = item.name || 'Unknown';
                if (!itemMap[itemName]) {
                    itemMap[itemName] = {
                        name: itemName,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        priceSum: 0,
                        priceCount: 0
                    };
                }

                const quantity = item.quantity || 0;
                const price = item.price || 0;
                const total = item.total || (price * quantity);

                itemMap[itemName].totalQuantity += quantity;
                itemMap[itemName].totalRevenue += total;
                itemMap[itemName].priceSum += price;
                itemMap[itemName].priceCount += 1;
            });
        } else {
            // Handle old format
            const itemName = sale.itemName || sale.dishName || 'Unknown';
            if (!itemMap[itemName]) {
                itemMap[itemName] = {
                    name: itemName,
                    totalQuantity: 0,
                    totalRevenue: 0,
                    priceSum: 0,
                    priceCount: 0
                };
            }

            const quantity = sale.quantity || 0;
            const price = sale.price || 0;
            const total = sale.total || (price * quantity);

            itemMap[itemName].totalQuantity += quantity;
            itemMap[itemName].totalRevenue += total;
            itemMap[itemName].priceSum += price;
            itemMap[itemName].priceCount += 1;
        }
    });

    // Convert to array and calculate averages
    let items = Object.values(itemMap).map(item => ({
        name: item.name,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
        averagePrice: item.priceCount > 0 ? item.priceSum / item.priceCount : 0
    }));

    // Apply search filter
    if (searchTerm) {
        items = items.filter(item =>
            item.name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    if (sortFilter === 'quantity-desc') {
        items.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else if (sortFilter === 'quantity-asc') {
        items.sort((a, b) => a.totalQuantity - b.totalQuantity);
    } else if (sortFilter === 'revenue-desc') {
        items.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sortFilter === 'revenue-asc') {
        items.sort((a, b) => a.totalRevenue - b.totalRevenue);
    } else if (sortFilter === 'name-asc') {
        items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortFilter === 'name-desc') {
        items.sort((a, b) => b.name.localeCompare(a.name));
    }

    // Display items
    const countEl = document.getElementById('itemsSalesCount');
    if (countEl) countEl.textContent = 'Count: ' + items.length;

    if (items.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align: center; padding: 20px; color: #999;">No sales data available</td>`;
        tbody.appendChild(tr);
    } else {
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: #333;">${item.name}</td>
                <td>${item.totalQuantity}</td>
                <td style="font-weight: 600; color: #1e3a5f;">Rs. ${formatNumber(item.totalRevenue)}</td>
                <td>Rs. ${formatNumber(item.averagePrice)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.switchSalesView = (view) => {
    const salesHistorySection = document.getElementById('salesHistorySection');
    const itemsSalesSection = document.getElementById('itemsSalesSection');
    const taxHistorySection = document.getElementById('taxHistorySection');
    const salesHistoryBtn = document.getElementById('salesHistoryBtn');
    const itemsSalesBtn = document.getElementById('itemsSalesBtn');
    const taxHistoryBtn = document.getElementById('taxHistoryBtn');

    if (!salesHistorySection || !itemsSalesSection || !taxHistorySection || !salesHistoryBtn || !itemsSalesBtn || !taxHistoryBtn) return;

    // Reset all buttons
    [salesHistoryBtn, itemsSalesBtn, taxHistoryBtn].forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#666';
        btn.style.border = '1px solid transparent';
        btn.style.padding = '10px 18px';
        btn.style.fontSize = '16px';
        btn.style.fontWeight = '500';
        btn.style.boxShadow = 'none';
    });

    // Hide all sections
    salesHistorySection.style.display = 'none';
    itemsSalesSection.style.display = 'none';
    taxHistorySection.style.display = 'none';

    if (view === 'history') {
        salesHistorySection.style.display = 'block';
        salesHistoryBtn.style.background = '#4a90e2';
        salesHistoryBtn.style.color = '#ffffff';
        salesHistoryBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        salesHistoryBtn.style.fontWeight = '600';
        salesHistoryBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    } else if (view === 'items') {
        itemsSalesSection.style.display = 'block';
        itemsSalesBtn.style.background = '#4a90e2';
        itemsSalesBtn.style.color = '#ffffff';
        itemsSalesBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        itemsSalesBtn.style.fontWeight = '600';
        itemsSalesBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        loadItemsSales(); // Load data when switching to items view
    } else if (view === 'tax') {
        taxHistorySection.style.display = 'block';
        taxHistoryBtn.style.background = '#4a90e2';
        taxHistoryBtn.style.color = '#ffffff';
        taxHistoryBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        taxHistoryBtn.style.fontWeight = '600';
        taxHistoryBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        loadTaxHistory(); // Load data when switching to tax view
    }
};

window.deleteSale = (orderId, buttonElement) => {
    // Require password before deletion
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement || !btnElement.parentElement || !document.contains(buttonElement)) {
            // Try to find the button in the DOM by looking for the order row
            const salesRows = document.querySelectorAll('#salesTableBody tr');
            for (let row of salesRows) {
                const deleteBtn = row.querySelector('button[onclick*="deleteSale"]');
                if (deleteBtn) {
                    const onclickAttr = deleteBtn.getAttribute('onclick') || '';
                    if (onclickAttr.includes(`"${orderId}"`) || onclickAttr.includes(`'${orderId}'`) || onclickAttr.includes(`(${orderId},`)) {
                        btnElement = deleteBtn;
                        break;
                    }
                }
            }
        }

        if (btnElement && btnElement.parentElement && document.contains(btnElement)) {
            showDeleteConfirmation(btnElement, deleteSaleConfirmed, orderId);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteSaleConfirmed(orderId);
        }
    });
};

function deleteSaleConfirmed(orderId) {
    const sales = Storage.get('sales');
    // Delete all items with this orderId
    const filtered = sales.filter(s => s.orderId !== orderId && s.id !== orderId);
    Storage.set('sales', filtered);
    loadSales();
}

window.clearAllSales = () => {
    if (confirm('Are you sure you want to clear ALL sales? This action cannot be undone!')) {
        Storage.set('sales', []);
        loadSales();
        // Refresh items sales if that view is currently active
        const itemsSalesSection = document.getElementById('itemsSalesSection');
        if (itemsSalesSection && itemsSalesSection.style.display !== 'none') {
            loadItemsSales();
        }
        alert('All sales have been cleared.');
    }
};

window.viewSale = (orderId) => {
    const sales = Storage.get('sales');
    const order = sales.find(s => s.orderId === orderId || s.id === orderId);

    if (!order) {
        alert('Order not found!');
        return;
    }

    const modal = document.getElementById('saleModal');
    const modalBody = document.getElementById('saleModalBody');

    if (!modal || !modalBody) return;

    const orderDate = new Date(order.date);
    const dateStr = formatDate(orderDate);
    const timeStr = formatTime(orderDate);
    const displayOrderNumber = (order.orderNumber || extractOrderNumber(order.orderId || order.id) || '').toString().padStart(7, '0');

    let itemsHtml = '';
    if (order.items && Array.isArray(order.items)) {
        itemsHtml = order.items.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e0e0e0;">
                <div>
                    <strong>${item.name}</strong><br>
                    <span style="color: #666; font-size: 14px;">Qty: ${item.quantity} × Rs.${formatNumber(item.price)}</span>
                </div>
                <div style="font-weight: 600; color: #2c3e50;">Rs.${formatNumber(item.total)}</div>
            </div>
        `).join('');
    } else {
        // Legacy format - single item
        itemsHtml = `
            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e0e0e0;">
                <div>
                    <strong>${order.itemName || order.dishName || 'Unknown'}</strong><br>
                    <span style="color: #666; font-size: 14px;">Qty: ${order.quantity} × Rs.${formatNumber(order.price)}</span>
                </div>
                <div style="font-weight: 600; color: #2c3e50;">Rs.${formatNumber(order.total)}</div>
            </div>
        `;
    }

    const subtotalForDisplay = (typeof order.subtotal === 'number') ? order.subtotal : (order.total || 0);
    const discountAmount = getDiscountAmountFromOrder(order, subtotalForDisplay);
    const discountedSubtotal = Math.max(0, subtotalForDisplay - discountAmount);
    const paymentMethod = order.paymentMethod || 'cash';
    // Exclude tax for Parcel/Delivery orders
    const taxAmount = (paymentMethod === 'delivery' || paymentMethod === 'parcel') ? 0 : (order.tax !== undefined ? order.tax : (discountedSubtotal * SALES_TAX_RATE));
    const serviceChargesAmount = (paymentMethod === 'delivery' || paymentMethod === 'parcel') ? 0 : (order.serviceCharges !== undefined ? order.serviceCharges : (discountedSubtotal * SERVICE_CHARGE_RATE));
    const isParcelOrder = (paymentMethod === 'delivery' || paymentMethod === 'parcel');

    modalBody.innerHTML = `
        <div style="margin-bottom: 20px;">
            <p><strong>Order No.:</strong> #${displayOrderNumber}</p>
            <p><strong>Date:</strong> ${dateStr} ${timeStr}</p>
            <p><strong>${t('Location')}:</strong> ${formatLocation(order.paymentMethod)}</p>
            <p><strong>Customer:</strong> ${order.customerName ? escapeHtml(order.customerName) : '-'}</p>
        </div>
        <div style="border-top: 2px solid #e0e0e0; padding-top: 15px;">
            <h4 style="margin-bottom: 10px;">Items:</h4>
            ${itemsHtml}
        </div>
        <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #e0e0e0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Subtotal:</span>
                <span>Rs.${formatNumber(subtotalForDisplay)}</span>
            </div>
            ${discountAmount > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Discount:</span>
                <span style="color: #e74c3c;">-Rs.${formatNumber(discountAmount)}</span>
            </div>` : ''}
            ${!isParcelOrder && (taxAmount > 0 || serviceChargesAmount > 0) ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px;">
                <span>GST (5%): Rs.${formatNumber(taxAmount)}</span>
                <span>Serv. Charges (10%): Rs.${formatNumber(serviceChargesAmount)}</span>
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #2c3e50; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0;">
                <span>Total:</span>
                <span>Rs.${formatNumber(order.total)}</span>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
};

window.closeSaleModal = () => {
    const modal = document.getElementById('saleModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.printReceiptForSale = (orderId) => {
    const sales = Storage.get('sales');
    const order = sales.find(s => s.orderId === orderId || s.id === orderId);

    if (!order) {
        alert('Order not found!');
        return;
    }

    const displayOrderNumber = (order.orderNumber || extractOrderNumber(order.orderId || order.id) || '').toString().padStart(7, '0');

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${order.customerName || '-'}\n`;
    if (order.tableNo) {
        receipt += `Table No: ${order.tableNo}\n`;
    }
    if (order.waiter) {
        receipt += `Waiter: ${order.waiter}\n`;
    }
    receipt += `${t('Location')}: ${formatLocation(order.paymentMethod)}\n`;

    // Format date and time
    const orderDate = new Date(order.date);
    const dateStr = formatDate(orderDate);
    const timeStr = formatTime(orderDate);
    receipt += `${t('Date')}: ${dateStr} ${timeStr}\n`;
    const receiveTimeReceipt6 = calculateReceiveTime(timeStr, orderDate);
    receipt += `Order Receive Time: ${receiveTimeReceipt6}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;

    if (order.items && Array.isArray(order.items)) {
        receipt += formatReceiptItems(order.items);
    } else {
        // Legacy format - single item
        receipt += formatReceiptItems([{
            name: order.itemName || order.dishName || 'Unknown',
            quantity: order.quantity || 0,
            price: order.price || 0
        }]);
    }

    // Calculate subtotal from items
    const subtotal = order.subtotal || (order.items && Array.isArray(order.items)
        ? order.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
        : (order.total || 0));

    // Calculate discount amount
    const discountAmount = getDiscountAmountFromOrder(order, subtotal);

    receipt += formatReceiptSummary(subtotal, discountAmount, (order.tax || 0), (order.serviceCharges || 0), order.total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Escape receipt content for embedding in JavaScript string
    const escapedReceipt = receipt
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')  // Escape carriage returns
        .replace(/`/g, '\\`');   // Escape backticks

    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt - ${displayOrderNumber}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 13px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0 auto;
                        max-width: 80mm;
                    }
                    .receipt-logo {
                        max-width: 120px;
                        max-height: 120px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 10px auto;
                        display: block;
                        object-fit: contain;
                    }
                    pre {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        text-align: center;
                        margin: 0;
                        padding: 0;
                        font-weight: bold;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    }
                    .order-id-line {
                        font-size: 16px;
                        font-weight: 700;
                    }
                    .restaurant-heading {
                        font-size: 20px;
                        font-weight: 900;
                    }
                    .items-list {
                        font-size: 9px;
                        font-family: 'Courier New', monospace;
                    }
                        @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                        }
                        .receipt-logo {
                            max-width: 100px;
                            max-height: 100px;
                            margin: 0 auto 0 auto;
                        }
                        #receiptContent {
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin: 0;
                            padding: 0;
                            line-height: 1.2;
                            font-size: 10px;
                        }
                        #receiptContent table {
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        .order-id-line {
                            font-size: 16px !important;
                            font-weight: 700 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div id="receiptContent" style="text-align: center; white-space: pre-wrap; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: bold; font-size: 13px;"></div>
                <script>
                    window.onload = function() {
                        const receiptDiv = document.getElementById('receiptContent');
                        const receiptContent = '${escapedReceipt}';
                        if (receiptDiv) {
                            // Convert receipt string to HTML, handling tables properly
                            // Split by newlines but preserve HTML tables
                            const lines = receiptContent.split('\\n');
                            let processedLines = [];
                            
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                
                                // Check if this line contains HTML table tags
                                if (line.includes('<table') || line.includes('</table>') || line.includes('<tr') || line.includes('<td') || line.includes('<th') || line.includes('</tr>') || line.includes('</td>') || line.includes('</th>') || line.includes('<thead') || line.includes('</thead>') || line.includes('<tbody') || line.includes('</tbody>')) {
                                    // This is part of a table, add as-is
                                    processedLines.push(line);
                                } else {
                                    // Regular text line
                                    if (line.trim() === 'ABC Restaurant' || line.includes('ABC Restaurant')) {
                                        processedLines.push('<span class="restaurant-heading">' + line + '</span>');
                                    } else if (line.includes('Order No.:') || line.includes('Order No.') || line.includes('Order ID:') || line.includes('Order ID') || line.includes('Order:')) {
                                        processedLines.push('<span class="order-id-line">' + line + '</span>');
                                    } else {
                                        processedLines.push(line);
                                    }
                                }
                            }
                            
                            // Join lines, but don't add <br> between table lines
                            let html = '';
                            for (let i = 0; i < processedLines.length; i++) {
                                const line = processedLines[i];
                                const isTableLine = line.includes('<table') || line.includes('</table>') || line.includes('<tr') || line.includes('<td') || line.includes('<th') || line.includes('</tr>') || line.includes('</td>') || line.includes('</th>') || line.includes('<thead') || line.includes('</thead>') || line.includes('<tbody') || line.includes('</tbody>');
                                
                                if (isTableLine) {
                                    html += line;
                                } else {
                                    html += line + (i < processedLines.length - 1 ? '<br>' : '');
                                }
                            }
                            
                            receiptDiv.innerHTML = html;
                        }
                        // Delay print to ensure preview renders first
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 100);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

// updateDishDropdown function removed - form no longer exists

// Items Available Management - Removed

// Employee Management
let editingEmployeeId = null;
let currentAttendanceEmployeeId = null;

const employeeForm = document.getElementById('employeeForm');
if (employeeForm) {
    employeeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const employees = Storage.get('employees') || [];
        const name = document.getElementById('employeeName').value.trim();
        const salary = parseInt(document.getElementById('employeeSalary').value) || 0;
        const salaryDate = document.getElementById('employeeSalaryDate').value;

        if (editingEmployeeId !== null) {
            const index = employees.findIndex(emp => emp.id === editingEmployeeId);
            if (index !== -1) {
                const oldSalary = employees[index].salary || 0;
                employees[index] = {
                    ...employees[index],
                    name,
                    salary,
                    salaryDate
                };
            }
            editingEmployeeId = null;
        } else {
            const newEmployee = {
                id: Date.now(),
                name,
                salary,
                salaryDate,
                payouts: [] // Array of payout objects: {id, amount, date, notes}
            };
            employees.push(newEmployee);
        }

        Storage.set('employees', employees);
        document.getElementById('employeeForm').reset();
        closeAddEmployeeModal();
        loadEmployees();
    });
}

window.loadEmployees = function loadEmployees() {
    const employees = Storage.get('employees') || [];
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get filter values
    const searchQuery = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('employeeDateFilter')?.value || 'all';
    const selectedMonth = document.getElementById('employeeMonthFilter')?.value;

    // Migrate old employee data (convert numeric payouts to array)
    employees.forEach(emp => {
        if (!Array.isArray(emp.payouts) && typeof emp.payouts === 'number' && emp.payouts > 0) {
            // Convert old numeric payout to array format
            emp.payouts = [{
                id: Date.now(),
                amount: emp.payouts,
                date: emp.salaryDate || new Date().toISOString().split('T')[0],
                notes: 'Migrated from old format'
            }];
        } else if (!Array.isArray(emp.payouts)) {
            emp.payouts = [];
        }

        // Ensure each payout has time/createdAt (derive from id if possible)
        if (Array.isArray(emp.payouts)) {
            emp.payouts.forEach(p => {
                if (!p) return;
                if (!p.createdAt) {
                    const ts = typeof p.id === 'number' ? p.id : Date.now();
                    p.createdAt = new Date(ts).toISOString();
                }
                if (!p.time) {
                    p.time = formatTimeShort(new Date(p.createdAt));
                }
            });
        }
    });
    if (employees.some(emp => !Array.isArray(emp.payouts))) {
        Storage.set('employees', employees);
    }

    // Apply filters
    let filteredEmployees = employees.filter(emp => {
        const matchesSearch = searchQuery === '' || emp.name.toLowerCase().includes(searchQuery);

        let matchesDate = true;
        if (dateFilter === 'specific-month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            if (emp.salaryDate) {
                const sDate = new Date(emp.salaryDate);
                matchesDate = sDate.getFullYear() === year && (sDate.getMonth() + 1) === month;
            } else {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    // Sort by name
    filteredEmployees.sort((a, b) => a.name.localeCompare(b.name));

    // Update summary cards
    const filteredTotalEmployees = filteredEmployees.length;
    const totalSalary = filteredEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const totalPayouts = filteredEmployees.reduce((sum, emp) => {
        let payouts = Array.isArray(emp.payouts) ? emp.payouts : [];
        if (dateFilter === 'specific-month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            payouts = payouts.filter(p => {
                const pDate = new Date(p.date || p.createdAt);
                return pDate.getFullYear() === year && (pDate.getMonth() + 1) === month;
            });
        }
        return sum + payouts.reduce((pSum, p) => pSum + (p.amount || 0), 0);
    }, 0);
    const remainingSalary = totalSalary - totalPayouts;

    const totalEmployeesEl = document.getElementById('totalEmployees');
    const totalSalaryEl = document.getElementById('totalSalary');
    const totalPayoutsEl = document.getElementById('totalPayouts');
    const remainingSalaryEl = document.getElementById('remainingSalary');
    const employeeCountTitle = document.getElementById('employeeCountTitle');

    if (totalEmployeesEl) totalEmployeesEl.textContent = formatNumber(filteredTotalEmployees);
    if (totalSalaryEl) totalSalaryEl.textContent = `Rs. ${formatNumber(totalSalary)}`;
    if (totalPayoutsEl) totalPayoutsEl.textContent = `Rs. ${formatNumber(totalPayouts)}`;
    if (remainingSalaryEl) remainingSalaryEl.textContent = `Rs. ${formatNumber(remainingSalary)}`;
    if (employeeCountTitle) {
        employeeCountTitle.textContent = dateFilter === 'specific-month' && selectedMonth ? `Employee Management (${selectedMonth})` : 'Employee Management';
    }

    const countEl = document.getElementById('employeeCount');
    if (countEl) countEl.textContent = 'Count: ' + filteredEmployees.length;

    if (filteredEmployees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No employees found</td></tr>';
        return;
    }

    filteredEmployees.forEach(employee => {
        const salary = employee.salary || 0;
        let payouts = Array.isArray(employee.payouts) ? employee.payouts : [];

        // Apply same payout filtering for table display
        if (dateFilter === 'specific-month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            payouts = payouts.filter(p => {
                const pDate = new Date(p.date || p.createdAt);
                return pDate.getFullYear() === year && (pDate.getMonth() + 1) === month;
            });
        }

        const totalPayoutAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
        const remaining = salary - totalPayoutAmount;
        const salaryDate = employee.salaryDate ? formatDate(new Date(employee.salaryDate)) : '-';
        const payoutsText = payouts.length > 0
            ? `Rs. ${formatNumber(totalPayoutAmount)} (${payouts.length} payout${payouts.length !== 1 ? 's' : ''})`
            : '—';

        // Main row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700;">${employee.name}</td>
            <td>${salaryDate}</td>
            <td style="font-weight: 700;">Rs. ${formatNumber(salary)}</td>
            <td>${payoutsText}</td>
            <td style="font-weight: 700; color: #4caf50;">Rs. ${formatNumber(remaining)}</td>
            <td>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button
                        onclick="openPayoutsListModal(${employee.id})"
                        id="payoutToggleBtn_${employee.id}"
                        ${payouts.length === 0 ? 'disabled' : ''}
                        style="
                            background: #4a90e2;
                            border: none;
                            padding: 6px 10px;
                            border-radius: 4px;
                            cursor: ${payouts.length === 0 ? 'not-allowed' : 'pointer'};
                            font-size: 16px;
                            color: white;
                            height: 32px;
                            width: 32px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            opacity: ${payouts.length === 0 ? '0.65' : '1'};
                        "
                        title="View Payouts (${payouts.length})"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </button>
                    <button onclick="openAttendanceModal(${employee.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Attendance">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </button>
                    <button onclick="openAddPayoutModal(${employee.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Add Payout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </button>
                    <button onclick="editEmployee(${employee.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                    </button>
                    <button onclick="deleteEmployee(${employee.id}, this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openAddEmployeeModal = () => {
    editingEmployeeId = null;
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    document.getElementById('employeeForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('employeeSalaryDate').value = today;
    document.getElementById('addEmployeeModal').style.display = 'flex';
};

window.closeAddEmployeeModal = () => {
    editingEmployeeId = null;
    document.getElementById('employeeForm').reset();
    document.getElementById('addEmployeeModal').style.display = 'none';
};

window.editEmployee = (id) => {
    // Require password before editing
    openActionPasswordModal(() => {
        const employees = Storage.get('employees') || [];
        const employee = employees.find(emp => emp.id === id);
        if (employee) {
            editingEmployeeId = id;
            document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
            document.getElementById('employeeName').value = employee.name;
            document.getElementById('employeeSalary').value = employee.salary || '';
            document.getElementById('employeeSalaryDate').value = employee.salaryDate || new Date().toISOString().split('T')[0];
            document.getElementById('addEmployeeModal').style.display = 'flex';
        }
    });
};

let editingPayoutId = null;
let currentPayoutEmployeeId = null;

window.openAddPayoutModal = (employeeId) => {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    editingPayoutId = null;
    currentPayoutEmployeeId = employeeId;
    document.getElementById('payoutModalTitle').textContent = 'Add Daily Payout';
    document.getElementById('payoutEmployeeName').textContent = employee.name;

    const salary = employee.salary || 0;
    const payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
    const totalPayoutAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = salary - totalPayoutAmount;
    document.getElementById('payoutRemainingSalary').textContent = formatNumber(remaining);
    document.getElementById('payoutAfterAmount').textContent = formatNumber(remaining);

    document.getElementById('payoutForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('payoutDate').value = today;
    document.getElementById('addPayoutModal').style.display = 'flex';

    // Add real-time calculation for "After this Payout"
    updatePayoutAfterAmount(remaining);

    // Update discount display
    const discountElement = document.querySelector('.discount-row');
    if (currentDiscount.type) {
        const discountText = currentDiscount.type === 'fixed'
            ? `Rs.${formatNumber(currentDiscount.value)}`
            : `${currentDiscount.value}%`;
        discountElement.innerHTML = `
            <span>Discount (${currentDiscount.type === 'fixed' ? 'Fixed' : 'Percentage'})</span>
            <div>
                <span style="color: #e74c3c; margin-right: 10px;">-${discountText}</span>
                <a href="#" onclick="clearDiscount()" style="color: #e74c3c; text-decoration: none; font-weight: 600; font-size: 14px;">Remove</a>
            </div>`;
    } else {
        discountElement.innerHTML = `
            <span>Discount</span>
            <a href="#" id="applyDiscount" style="color: #4a90e2; text-decoration: none; font-weight: 600;" onclick="showDiscountModal(); return false;">Apply</a>`;
        // Re-attach event listener to the new Apply link
        document.getElementById('applyDiscount').addEventListener('click', (e) => {
            e.preventDefault();
            showDiscountModal();
        });
    }

    document.getElementById('cartTotal').textContent = `Rs.${formatNumber(total)}`;
};

window.closeAddPayoutModal = () => {
    document.getElementById('addPayoutModal').style.display = 'none';
    editingPayoutId = null;
    currentPayoutEmployeeId = null;

    // Remove event listener
    const amountInput = document.getElementById('payoutAmount');
    if (amountInput && payoutAmountHandler) {
        amountInput.removeEventListener('input', payoutAmountHandler);
        payoutAmountHandler = null;
    }
};

// Payouts list (Excel-like) modal
let currentPayoutsListEmployeeId = null;
let currentPayoutsListEditingPayoutId = null;

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderPayoutsListModal(employeeId) {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(e => String(e.id) === String(employeeId));
    const nameEl = document.getElementById('payoutsListEmployeeName');
    const summaryEl = document.getElementById('payoutsListSummary');
    const tbody = document.getElementById('payoutsListTbody');
    if (!employee || !tbody) return;

    const salary = employee.salary || 0;
    const payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
    const totalPayoutAmount = payouts.reduce((sum, p) => sum + (p?.amount || 0), 0);
    const remaining = salary - totalPayoutAmount;

    if (nameEl) nameEl.textContent = employee.name || '';
    if (summaryEl) summaryEl.textContent = `Total Payouts: Rs. ${formatNumber(totalPayoutAmount)} • Remaining: Rs. ${formatNumber(remaining)} • Entries: ${payouts.length}`;

    if (payouts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#999; font-weight: 700;">No payouts found</td></tr>`;
        return;
    }

    // Sort newest first using createdAt/id as fallback
    const sorted = [...payouts].sort((a, b) => {
        const at = a?.createdAt ? new Date(a.createdAt).getTime() : (typeof a?.id === 'number' ? a.id : 0);
        const bt = b?.createdAt ? new Date(b.createdAt).getTime() : (typeof b?.id === 'number' ? b.id : 0);
        return bt - at;
    });

    tbody.innerHTML = sorted.map((p, idx) => {
        const payoutDate = p?.date ? formatDate(new Date(p.date + 'T00:00:00')) : '-';
        const payoutTime = p?.time || (p?.createdAt ? formatTimeShort(new Date(p.createdAt)) : '');
        const notes = (p?.notes || '').trim();
        const amount = p?.amount || 0;
        const isEditing = currentPayoutsListEditingPayoutId && String(currentPayoutsListEditingPayoutId) === String(p?.id);
        const dateValue = p?.date || '';
        const timeValue = payoutTime || '';
        const notesValue = notes || '';
        const amountValue = Number(amount || 0);

        if (isEditing) {
            return `
                <tr>
                    <td style="text-align:center; font-weight: 800;">${idx + 1}</td>
                    <td>${payoutDate}</td>
                    <td>${payoutTime || '-'}</td>
                    <td style="text-align:right;">
                        <input id="payoutsEditAmount" type="number" min="0" step="1" value="${escapeHtml(amountValue)}" style="width: 100%; padding: 6px 8px; border: 1px solid #d8d8d8; border-radius: 6px; font-size: 13px; text-align: right;" />
                    </td>
                    <td>
                        <input id="payoutsEditNotes" type="text" value="${escapeHtml(notesValue)}" placeholder="Notes" style="width: 100%; padding: 6px 8px; border: 1px solid #d8d8d8; border-radius: 6px; font-size: 13px;" />
                    </td>
                    <td style="text-align:center; white-space: nowrap;">
                        <button onclick="saveInlinePayoutEdit(${employee.id}, ${p.id})" style="background: #4caf50; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; color: white;" title="Save">✔</button>
                        <button onclick="cancelInlinePayoutEdit()" style="background: #9e9e9e; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; color: white; margin-left: 6px;" title="Cancel">✖</button>
                    </td>
                </tr>
            `;
        }
        return `
            <tr>
                <td style="text-align:center; font-weight: 800;">${idx + 1}</td>
                <td>${payoutDate}</td>
                <td>${payoutTime || '-'}</td>
                <td style="text-align:right; font-weight: 800;">Rs. ${formatNumber(amount)}</td>
                <td style="white-space: pre-wrap;">${notes ? escapeHtml(notes) : '<span style="color:#999;">—</span>'}</td>
                <td style="text-align:center; white-space: nowrap;">
                    <button onclick="startInlinePayoutEdit(${employee.id}, ${p.id})" style="background: #ffc107; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px;" title="Edit">✏️</button>
                    <button onclick="deletePayout(${employee.id}, ${p.id}, this)" style="background: #757575; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; color: white; margin-left: 6px;" title="Delete">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.openPayoutsListModal = (employeeId) => {
    currentPayoutsListEmployeeId = employeeId;
    currentPayoutsListEditingPayoutId = null;
    const modal = document.getElementById('payoutsListModal');
    if (modal) modal.style.display = 'flex';
    renderPayoutsListModal(employeeId);
};

window.closePayoutsListModal = () => {
    const modal = document.getElementById('payoutsListModal');
    if (modal) modal.style.display = 'none';
    currentPayoutsListEmployeeId = null;
    currentPayoutsListEditingPayoutId = null;
};

window.startInlinePayoutEdit = (employeeId, payoutId) => {
    currentPayoutsListEmployeeId = employeeId;
    currentPayoutsListEditingPayoutId = payoutId;
    renderPayoutsListModal(employeeId);
    // Focus amount for quick edit
    setTimeout(() => {
        const el = document.getElementById('payoutsEditAmount');
        if (el) el.focus();
    }, 0);
};

window.cancelInlinePayoutEdit = () => {
    if (!currentPayoutsListEmployeeId) return;
    currentPayoutsListEditingPayoutId = null;
    renderPayoutsListModal(currentPayoutsListEmployeeId);
};

window.saveInlinePayoutEdit = (employeeId, payoutId) => {
    const amountEl = document.getElementById('payoutsEditAmount');
    const notesEl = document.getElementById('payoutsEditNotes');
    if (!amountEl || !notesEl) return;

    const amount = parseInt(amountEl.value, 10) || 0;
    const notes = (notesEl.value || '').trim();

    if (amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    const employees = Storage.get('employees') || [];
    const employee = employees.find(emp => String(emp.id) === String(employeeId));
    if (!employee) return;
    const payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
    const index = payouts.findIndex(p => String(p?.id) === String(payoutId));
    if (index === -1) return;

    const prev = payouts[index] || {};
    payouts[index] = {
        ...prev,
        id: prev.id,
        amount,
        notes,
        // Keep date and time unchanged
        date: prev.date,
        time: prev.time,
        // Keep createdAt unless missing
        createdAt: prev.createdAt || new Date().toISOString()
    };

    employee.payouts = payouts;
    Storage.set('employees', employees);
    loadEmployees();

    currentPayoutsListEmployeeId = employeeId;
    currentPayoutsListEditingPayoutId = null;
    renderPayoutsListModal(employeeId);
};

window.openAddPayoutFromPayoutsList = () => {
    if (!currentPayoutsListEmployeeId) return;
    // Avoid stacking two overlays
    const listModal = document.getElementById('payoutsListModal');
    if (listModal) listModal.style.display = 'none';
    openAddPayoutModal(currentPayoutsListEmployeeId);
};

function getLocalISODate(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getEmployeeAttendance() {
    return Storage.get('employeeAttendance') || [];
}

function setEmployeeAttendance(records) {
    Storage.set('employeeAttendance', records);
}

function renderAttendance(employeeId) {
    const listEl = document.getElementById('attendanceList');
    const inBtn = document.getElementById('attendanceTimeInBtn');
    const outBtn = document.getElementById('attendanceTimeOutBtn');
    if (!listEl) return;

    const records = getEmployeeAttendance()
        .filter(r => String(r.employeeId) === String(employeeId))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const today = getLocalISODate();
    const todayRec = records.find(r => r.date === today);
    if (inBtn) inBtn.disabled = !!(todayRec && todayRec.timeIn);
    if (outBtn) outBtn.disabled = !(todayRec && todayRec.timeIn) || !!(todayRec && todayRec.timeOut);

    if (records.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding: 20px; color:#999;">${t('No attendance found')}</div>`;
        return;
    }

    listEl.innerHTML = records.map(rec => {
        const d = rec.date ? formatDate(new Date(rec.date + 'T00:00:00')) : '-';
        const ti = rec.timeIn || '-';
        const to = rec.timeOut || '-';
        const statusColor = rec.timeIn && rec.timeOut ? '#4caf50' : (rec.timeIn ? '#ff9800' : '#9e9e9e');
        const statusText = rec.timeIn && rec.timeOut ? 'Complete' : (rec.timeIn ? 'In' : '—');
        return `
            <div style="background: #ffffff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px; display: flex; justify-content: space-between; gap: 12px; align-items: center;">
                <div>
                    <div style="font-weight: 700; color:#333; margin-bottom: 4px;">${d}</div>
                    <div style="color:#666; font-size: 13px; display: flex; gap: 14px; flex-wrap: wrap;">
                        <span><strong>${t('Time In')}:</strong> ${ti}</span>
                        <span><strong>${t('Time Out')}:</strong> ${to}</span>
                    </div>
                </div>
                <span style="background: ${statusColor}; color:#fff; padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; white-space: nowrap;">${statusText}</span>
            </div>
        `;
    }).join('');
}

window.openAttendanceModal = (employeeId) => {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(e => String(e.id) === String(employeeId));
    if (!employee) return;
    currentAttendanceEmployeeId = employeeId;
    const modal = document.getElementById('attendanceModal');
    const nameEl = document.getElementById('attendanceEmployeeName');
    const titleEl = document.getElementById('attendanceModalTitle');
    if (titleEl) titleEl.textContent = t('Attendance');
    if (nameEl) nameEl.textContent = `${employee.name}`;
    if (modal) modal.style.display = 'flex';
    renderAttendance(employeeId);
};

window.closeAttendanceModal = () => {
    const modal = document.getElementById('attendanceModal');
    if (modal) modal.style.display = 'none';
    currentAttendanceEmployeeId = null;
};

window.attendanceTimeIn = () => {
    if (!currentAttendanceEmployeeId) return;
    const now = new Date();
    const today = getLocalISODate(now);
    const records = getEmployeeAttendance();
    let rec = records.find(r => String(r.employeeId) === String(currentAttendanceEmployeeId) && r.date === today);
    if (!rec) {
        rec = { employeeId: currentAttendanceEmployeeId, date: today, timeIn: formatTime(now), timeOut: null, createdAt: now.toISOString() };
        records.push(rec);
    } else if (!rec.timeIn) {
        rec.timeIn = formatTime(now);
    }
    setEmployeeAttendance(records);
    renderAttendance(currentAttendanceEmployeeId);
};

window.attendanceTimeOut = () => {
    if (!currentAttendanceEmployeeId) return;
    const now = new Date();
    const today = getLocalISODate(now);
    const records = getEmployeeAttendance();
    const rec = records.find(r => String(r.employeeId) === String(currentAttendanceEmployeeId) && r.date === today);
    if (!rec || !rec.timeIn) {
        alert('Please Time In first');
        return;
    }
    if (!rec.timeOut) {
        rec.timeOut = formatTime(now);
    }
    setEmployeeAttendance(records);
    renderAttendance(currentAttendanceEmployeeId);
};

window.editPayout = (employeeId, payoutId) => {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    const payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
    const payout = payouts.find(p => p.id === payoutId);
    if (!payout) return;

    editingPayoutId = payoutId;
    currentPayoutEmployeeId = employeeId;
    document.getElementById('payoutModalTitle').textContent = 'Edit Daily Payout';
    document.getElementById('payoutEmployeeName').textContent = employee.name;

    const salary = employee.salary || 0;
    // When editing, add back the current payout amount to remaining salary
    const currentPayoutAmount = payout.amount || 0;
    const totalPayoutAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    const remaining = salary - totalPayoutAmount + currentPayoutAmount; // Add back the payout being edited
    document.getElementById('payoutRemainingSalary').textContent = formatNumber(remaining);

    document.getElementById('payoutAmount').value = payout.amount || '';
    document.getElementById('payoutDate').value = payout.date || '';
    document.getElementById('payoutNotes').value = payout.notes || '';
    document.getElementById('addPayoutModal').style.display = 'flex';

    // Add real-time calculation for "After this Payout"
    updatePayoutAfterAmount(remaining);
};

let payoutAmountHandler = null;

function updatePayoutAfterAmount(baseRemaining) {
    const amountInput = document.getElementById('payoutAmount');
    const afterAmountEl = document.getElementById('payoutAfterAmount');

    if (!amountInput || !afterAmountEl) return;

    // Remove existing event listener if any
    if (payoutAmountHandler) {
        amountInput.removeEventListener('input', payoutAmountHandler);
    }

    // Create new handler
    payoutAmountHandler = () => {
        const payoutAmount = parseInt(amountInput.value) || 0;
        const currencyEl = document.getElementById('payoutAfterAmountCurrency');

        // Change color and text based on whether amount exceeds remaining
        if (payoutAmount > baseRemaining) {
            afterAmountEl.style.color = '#e74c3c'; // Red if exceeds
            afterAmountEl.textContent = 'Exceeds limit!';
            if (currencyEl) currencyEl.style.display = 'none'; // Hide Rs. when exceeds
        } else {
            const afterAmount = baseRemaining - payoutAmount;
            afterAmountEl.style.color = '#4caf50'; // Green if valid
            afterAmountEl.textContent = formatNumber(afterAmount);
            if (currencyEl) currencyEl.style.display = 'inline'; // Show Rs. when valid
        }

        // Add visual feedback to input field
        if (payoutAmount > baseRemaining) {
            amountInput.style.borderColor = '#e74c3c';
            amountInput.style.borderWidth = '2px';
        } else {
            amountInput.style.borderColor = '#e0e0e0';
            amountInput.style.borderWidth = '2px';
        }
    };

    // Add event listener
    amountInput.addEventListener('input', payoutAmountHandler);

    // Trigger initial calculation
    payoutAmountHandler();
}

window.deletePayout = (employeeId, payoutId, buttonElement) => {
    if (buttonElement) {
        showDeleteConfirmation(buttonElement, deletePayoutConfirmed, employeeId, payoutId);
        return;
    }
    deletePayoutConfirmed(employeeId, payoutId);
};

function deletePayoutConfirmed(employeeId, payoutId) {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    const payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
    employee.payouts = payouts.filter(p => p.id !== payoutId);
    Storage.set('employees', employees);
    loadEmployees();
    if (currentPayoutsListEmployeeId && String(currentPayoutsListEmployeeId) === String(employeeId)) {
        renderPayoutsListModal(employeeId);
    }
}

window.resetEmployeePayouts = (employeeId) => {
    const employees = Storage.get('employees') || [];
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;

    employee.payouts = [];
    Storage.set('employees', employees);
    loadEmployees();
    if (currentPayoutsListEmployeeId && String(currentPayoutsListEmployeeId) === String(employeeId)) {
        renderPayoutsListModal(employeeId);
    }
};

window.showResetPayoutsConfirmation = () => {
    const container = document.getElementById('resetPayoutsButtonContainer');
    if (!container) return;

    container.innerHTML = `
        <button type="button" onclick="confirmResetPayouts()" style="background: #4caf50; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Confirm">✓</button>
        <button type="button" onclick="cancelResetPayouts()" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Cancel">✕</button>
    `;
};

window.confirmResetPayouts = () => {
    if (!currentPayoutsListEmployeeId) return;
    resetEmployeePayouts(currentPayoutsListEmployeeId);
    cancelResetPayouts(); // Reset the button state
};

window.cancelResetPayouts = () => {
    const container = document.getElementById('resetPayoutsButtonContainer');
    if (!container) return;

    container.innerHTML = `
        <button type="button" id="resetPayoutsButton" onclick="showResetPayoutsConfirmation()" style="background: #2196f3; color: white; border: none; padding: 10px 14px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 14px; min-width: 120px;">↻ Reset Payouts</button>
    `;
};

window.resetEmployeePayoutsFromList = () => {
    if (!currentPayoutsListEmployeeId) return;
    resetEmployeePayouts(currentPayoutsListEmployeeId);
};

// Payout form handler
const payoutForm = document.getElementById('payoutForm');
if (payoutForm) {
    payoutForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentPayoutEmployeeId) return;

        const employees = Storage.get('employees') || [];
        const employee = employees.find(emp => emp.id === currentPayoutEmployeeId);
        if (!employee) return;

        const amount = parseInt(document.getElementById('payoutAmount').value) || 0;
        const date = document.getElementById('payoutDate').value;
        const notes = document.getElementById('payoutNotes').value.trim();

        if (amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Calculate remaining salary (excluding the payout being edited if editing)
        let payouts = Array.isArray(employee.payouts) ? employee.payouts : [];
        const salary = employee.salary || 0;
        let totalPayouts = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);

        // If editing, subtract the old payout amount
        if (editingPayoutId !== null) {
            const oldPayout = payouts.find(p => p.id === editingPayoutId);
            if (oldPayout) {
                totalPayouts -= (oldPayout.amount || 0);
            }
        }

        const remainingSalary = salary - totalPayouts;

        // Validate that amount doesn't exceed remaining salary
        if (amount > remainingSalary) {
            alert(`Amount cannot exceed remaining salary of Rs. ${formatNumber(remainingSalary)}`);
            return;
        }

        const now = new Date();
        const nowIso = now.toISOString();
        const nowTime = formatTimeShort(now);

        if (editingPayoutId !== null) {
            // Edit existing payout
            const index = payouts.findIndex(p => p.id === editingPayoutId);
            if (index !== -1) {
                const prev = payouts[index] || {};
                payouts[index] = {
                    ...prev,
                    id: editingPayoutId,
                    amount,
                    date,
                    notes,
                    createdAt: prev.createdAt || nowIso,
                    time: prev.time || formatTimeShort(new Date(prev.createdAt || nowIso))
                };
            }
        } else {
            // Add new payout
            const newPayout = {
                id: Date.now(),
                amount,
                date,
                notes,
                createdAt: nowIso,
                time: nowTime
            };
            payouts.push(newPayout);
        }

        employee.payouts = payouts;
        Storage.set('employees', employees);
        loadEmployees();
        closeAddPayoutModal();
        if (currentPayoutsListEmployeeId && String(currentPayoutsListEmployeeId) === String(currentPayoutEmployeeId)) {
            renderPayoutsListModal(currentPayoutEmployeeId);
        }
    });
}

window.deleteEmployee = (id, buttonElement) => {
    // Require password before deletion
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement || !btnElement.parentElement || !document.contains(buttonElement)) {
            // Try to find the button in the DOM by looking for the employee row
            const employeeRows = document.querySelectorAll('#employeeTableBody tr, .employee-row');
            for (let row of employeeRows) {
                const deleteBtn = row.querySelector('button[onclick*="deleteEmployee"]');
                if (deleteBtn) {
                    const onclickAttr = deleteBtn.getAttribute('onclick') || '';
                    if (onclickAttr.includes(`"${id}"`) || onclickAttr.includes(`'${id}'`) || onclickAttr.includes(`(${id},`)) {
                        btnElement = deleteBtn;
                        break;
                    }
                }
            }
        }

        if (btnElement && btnElement.parentElement && document.contains(btnElement)) {
            showDeleteConfirmation(btnElement, deleteEmployeeConfirmed, id);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteEmployeeConfirmed(id);
        }
    });
};

function deleteEmployeeConfirmed(id) {
    const employees = Storage.get('employees') || [];
    const filtered = employees.filter(emp => emp.id !== id);
    Storage.set('employees', filtered);
    loadEmployees();
}

// Waiters Management
let editingWaiterId = null;

window.loadWaiters = function loadWaiters() {
    const waiters = Storage.get('waiters') || [];
    const tbody = document.getElementById('waiterTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get search query
    const searchQuery = (document.getElementById('waiterSearch')?.value || '').toLowerCase().trim();

    // Filter waiters based on search
    let filteredWaiters = waiters;
    if (searchQuery) {
        filteredWaiters = waiters.filter(waiter =>
            (waiter.name || '').toLowerCase().includes(searchQuery)
        );
    }

    const countEl = document.getElementById('waiterCount');
    if (countEl) countEl.textContent = 'Count: ' + filteredWaiters.length;

    if (filteredWaiters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #999;">No waiters found. Add a waiter to get started.</td></tr>';
        return;
    }

    // Get only completed orders (sales) to count waiter orders - exclude hold orders
    const sales = Storage.get('sales') || [];

    // Sort by name
    filteredWaiters.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    filteredWaiters.forEach(waiter => {
        // Count only completed orders (sales) for this waiter - exclude hold orders
        const orderCount = sales.filter(sale => {
            const saleWaiter = sale.waiter || '';
            return saleWaiter.toLowerCase() === (waiter.name || '').toLowerCase();
        }).length;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 12px; font-weight: 600; color: #333;">${escapeHtml(waiter.name || 'N/A')}</td>
            <td style="padding: 12px; text-align: center; font-weight: 600; color: #4a90e2;">${orderCount}</td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="editWaiter(${waiter.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button onclick="deleteWaiter(${waiter.id}, this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

// Handle waiter form submission
document.addEventListener('DOMContentLoaded', () => {
    const waiterForm = document.getElementById('waiterForm');
    if (waiterForm) {
        waiterForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const waiters = Storage.get('waiters') || [];
            const name = document.getElementById('waiterName').value.trim();

            if (!name) {
                alert('Please enter a waiter name');
                return;
            }

            if (editingWaiterId) {
                // Update existing waiter
                const index = waiters.findIndex(w => w.id === editingWaiterId);
                if (index !== -1) {
                    // Check if another waiter with the same name exists (excluding current one)
                    const existingWaiter = waiters.find(w => w.name.toLowerCase() === name.toLowerCase() && w.id !== editingWaiterId);
                    if (existingWaiter) {
                        alert('A waiter with this name already exists!');
                        return;
                    }
                    waiters[index].name = name;
                    waiters[index].updatedAt = new Date().toISOString();
                }
            } else {
                // Check if waiter already exists
                const existingWaiter = waiters.find(w => w.name.toLowerCase() === name.toLowerCase());
                if (existingWaiter) {
                    alert('A waiter with this name already exists!');
                    return;
                }

                // Add new waiter
                const newWaiter = {
                    id: Date.now(),
                    name: name,
                    createdAt: new Date().toISOString()
                };
                waiters.push(newWaiter);
            }

            Storage.set('waiters', waiters);
            closeAddWaiterModal();
            loadWaiters();
            loadWaitersDropdown(); // Update POS dropdown
        });
    }
});

window.openAddWaiterModal = function openAddWaiterModal() {
    editingWaiterId = null;
    const form = document.getElementById('waiterForm');
    const modalTitle = document.getElementById('waiterModalTitle');

    if (form) form.reset();
    if (modalTitle) modalTitle.textContent = 'Add Waiter';

    document.getElementById('addWaiterModal').style.display = 'flex';
};

window.closeAddWaiterModal = function closeAddWaiterModal() {
    editingWaiterId = null;
    const form = document.getElementById('waiterForm');
    if (form) form.reset();
    document.getElementById('addWaiterModal').style.display = 'none';
};

window.editWaiter = function editWaiter(id) {
    // Require password before editing
    openActionPasswordModal(() => {
        const waiters = Storage.get('waiters') || [];
        const waiter = waiters.find(w => w.id === id);

        if (!waiter) {
            alert('Waiter not found!');
            return;
        }

        editingWaiterId = id;
        const form = document.getElementById('waiterForm');
        const modalTitle = document.getElementById('waiterModalTitle');

        if (modalTitle) modalTitle.textContent = 'Edit Waiter';
        if (form) {
            document.getElementById('waiterName').value = waiter.name || '';
        }

        document.getElementById('addWaiterModal').style.display = 'flex';
    });
};

window.deleteWaiter = function deleteWaiter(id, buttonElement) {
    // Require password before deleting
    if (buttonElement) {
        openActionPasswordModal(() => {
            const waiters = Storage.get('waiters') || [];
            const waiter = waiters.find(w => w.id === id);
            if (!waiter) {
                alert('Waiter not found!');
                return;
            }

            if (confirm(`Are you sure you want to delete "${waiter.name}"?`)) {
                const filtered = waiters.filter(w => w.id !== id);
                Storage.set('waiters', filtered);
                loadWaiters();
                loadWaitersDropdown(); // Update POS dropdown
            }
        });
    } else {
        const waiters = Storage.get('waiters') || [];
        const filtered = waiters.filter(w => w.id !== id);
        Storage.set('waiters', filtered);
        loadWaiters();
        loadWaitersDropdown(); // Update POS dropdown
    }
};

// Reset waiter selection to default
function resetWaiterSelection() {
    const waiterSelect = document.getElementById('selectedWaiter');
    if (waiterSelect) {
        waiterSelect.value = '';
    }
}

// Table selection functions
function setSelectedTableValue(number, displayText) {
    const hiddenInput = document.getElementById('selectedTable');
    const displayInput = document.getElementById('tableSearchInput');
    const dropdownContent = document.getElementById('tableDropdownContent');
    
    if (hiddenInput) hiddenInput.value = number;
    if (displayInput) displayInput.value = displayText || '-- Select Table No --';
    if (dropdownContent) dropdownContent.style.display = 'none';
}

function resetTableSelection() {
    setSelectedTableValue('', '');
}

// Load tables into the searchable dropdown, excluding busy ones currently in active hold orders
function loadTablesDropdown(callback) {
    const tableItemsContainer = document.getElementById('tableListItems');
    if (!tableItemsContainer) {
        if (callback) callback();
        return;
    }

    const tables = Storage.get('tables') || [];
    const holdOrders = Storage.get('holdOrders') || [];

    // Find table numbers currently selected in pending/active hold orders
    const busyTables = new Set();
    holdOrders.forEach(order => {
        if (order.status === 'pending' && order.tableNo) {
            busyTables.add(String(order.tableNo));
        }
    });

    // Check if we are currently editing a hold order
    let currentEditingTable = null;
    if (editingHoldOrderId) {
        const currentEditingOrder = holdOrders.find(o => o.id === editingHoldOrderId);
        if (currentEditingOrder && currentEditingOrder.tableNo) {
            currentEditingTable = String(currentEditingOrder.tableNo);
        }
    }

    // Filter tables: exclude busy ones unless it is the one currently being edited
    const availableTables = tables.filter(t => {
        const numStr = String(t.number);
        const isBusy = busyTables.has(numStr);
        const isOwn = currentEditingTable && numStr === currentEditingTable;
        return !isBusy || isOwn;
    });

    // Sort by table number
    availableTables.sort((a, b) => a.number - b.number);

    // Clear existing items
    tableItemsContainer.innerHTML = '';

    // Add table options
    availableTables.forEach(t => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 4px 10px; cursor: pointer; font-size: 13px; color: #1f2937; font-family: "Inter", sans-serif; transition: background 0.15s; border-radius: 4px; margin: 0 4px;';
        item.textContent = `Table ${t.number} (${t.seats || 0} seats)`;
        item.setAttribute('data-table-no', t.number);
        
        item.onmouseenter = () => { item.style.backgroundColor = '#f3f4f6'; };
        item.onmouseleave = () => { item.style.backgroundColor = 'transparent'; };
        item.onclick = () => {
            setSelectedTableValue(t.number, `Table ${t.number}`);
        };
        tableItemsContainer.appendChild(item);
    });

    if (callback) {
        callback();
    }
}

// Customer Name functions
function getCustomerName() {
    const inputEl = document.getElementById('customerNameInput');
    if (inputEl) {
        return inputEl.value.trim() || '';
    }
    return '';
}

function resetCustomerName() {
    const inputEl = document.getElementById('customerNameInput');
    if (inputEl) {
        inputEl.value = '';
    }
    currentCustomerName = '';
}

// Load waiters into the POS dropdown
function loadWaitersDropdown(callback) {
    const waiterSelect = document.getElementById('selectedWaiter');
    if (!waiterSelect) {
        if (callback) callback();
        return;
    }

    const waiters = Storage.get('waiters') || [];

    // Clear existing options except the first one
    waiterSelect.innerHTML = '<option value="">-- Select Waiter --</option>';

    // Sort waiters by name
    const sortedWaiters = [...waiters].sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Add waiters as options
    sortedWaiters.forEach(waiter => {
        if (waiter.name) {
            const option = document.createElement('option');
            option.value = waiter.name;
            option.textContent = waiter.name;
            waiterSelect.appendChild(option);
        }
    });

    // Call callback if provided (after options are added)
    if (callback) {
        callback();
    }
}

window.togglePayouts = (employeeId) => {
    openPayoutsListModal(employeeId);
};

window.openAddEmployeeModal = openAddEmployeeModal;
window.closeAddEmployeeModal = closeAddEmployeeModal;
window.openAddPayoutModal = openAddPayoutModal;
window.closeAddPayoutModal = closeAddPayoutModal;
window.editPayout = editPayout;
window.deletePayout = deletePayout;
window.resetEmployeePayouts = resetEmployeePayouts;
window.resetEmployeePayoutsFromList = resetEmployeePayoutsFromList;
window.showResetPayoutsConfirmation = showResetPayoutsConfirmation;
window.confirmResetPayouts = confirmResetPayouts;
window.cancelResetPayouts = cancelResetPayouts;

window.printEmployees = () => {
    const employees = Storage.get('employees') || [];
    const waiters = Storage.get('waiters') || [];
    const sales = Storage.get('sales') || [];
    const printWindow = window.open('', '_blank');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    // Get filter values (same as loadEmployees)
    const searchQuery = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    const dateFilter = document.getElementById('employeeDateFilter')?.value || 'all';
    const selectedMonth = document.getElementById('employeeMonthFilter')?.value;

    // Apply filters to employees (same as loadEmployees)
    let filteredEmployees = employees.filter(emp => {
        const matchesSearch = searchQuery === '' || emp.name.toLowerCase().includes(searchQuery);

        let matchesDate = true;
        if (dateFilter === 'specific-month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            if (emp.salaryDate) {
                const sDate = new Date(emp.salaryDate);
                matchesDate = sDate.getFullYear() === year && (sDate.getMonth() + 1) === month;
            } else {
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    // Sort by name
    filteredEmployees.sort((a, b) => a.name.localeCompare(b.name));

    // Build employee table rows
    let employeeRows = '';
    if (filteredEmployees.length === 0) {
        employeeRows = '<tr><td colspan="4" style="text-align: center; padding: 10px;">No employee data found</td></tr>';
    } else {
        filteredEmployees.forEach(emp => {
            const salary = emp.salary || 0;
            let payouts = Array.isArray(emp.payouts) ? emp.payouts : [];

            // Apply same payout filtering if specific month is selected
            if (dateFilter === 'specific-month' && selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number);
                payouts = payouts.filter(p => {
                    const pDate = new Date(p.date || p.createdAt);
                    return pDate.getFullYear() === year && (pDate.getMonth() + 1) === month;
                });
            }

            const totalPayoutAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
            const remaining = salary - totalPayoutAmount;

            employeeRows += `
                <tr>
                    <td style="text-align: left; padding: 1px 2px;">${escapeHtml(emp.name)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(salary)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(totalPayoutAmount)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(remaining)}</td>
                </tr>
            `;
        });
    }

    // Filter waiters if searching
    let filteredWaiters = waiters;
    if (searchQuery) {
        filteredWaiters = waiters.filter(w => (w.name || '').toLowerCase().includes(searchQuery));
    }

    // Build waiters table rows
    let waiterRows = '';
    if (filteredWaiters.length > 0) {
        filteredWaiters.forEach(waiter => {
            // Apply date filters to order counts if possible? 
            // Currently loadEmployees doesn't filter waiter order counts by month, 
            // but we could if we wanted. For now let's keep it consistent.
            const orderCount = sales.filter(sale => {
                const saleWaiter = sale.waiter || '';
                return saleWaiter.toLowerCase() === (waiter.name || '').toLowerCase();
            }).length;

            waiterRows += `
                <tr>
                    <td style="text-align: left; padding: 1px 2px;">${escapeHtml(waiter.name || 'N/A')}</td>
                    <td style="text-align: right; padding: 1px 2px;">${orderCount}</td>
                </tr>
            `;
        });
    }

    // Filter label for header
    let reportLabel = 'EMPLOYEE REPORT';
    if (dateFilter === 'specific-month' && selectedMonth) {
        reportLabel = `EMPLOYEE REPORT (${selectedMonth})`;
    }

    printWindow.document.write(`
        <html>
            <head>
                <title>Employee Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 11px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 900;
                        margin-bottom: 4px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 8px 0;
                    }
                    .report-info {
                        font-size: 10px;
                        margin: 4px 0;
                        font-weight: 600;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 700;
                        margin: 8px 0 4px 0;
                        text-align: center;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                        font-size: 9px;
                    }
                    thead {
                        border-bottom: 2px solid #000;
                    }
                    th {
                        padding: 6px 2px;
                        text-align: left;
                        font-weight: 700;
                        font-size: 10px;
                    }
                    th:nth-child(2),
                    th:nth-child(3),
                    th:nth-child(4) {
                        text-align: right;
                    }
                    td {
                        padding: 2px 2px;
                        border-bottom: 1px dotted #ccc;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    td:nth-child(2),
                    td:nth-child(3),
                    td:nth-child(4) {
                        text-align: right;
                    }
                    .summary-section {
                        text-align: center;
                        margin-top: 8px;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                            max-width: 80mm;
                        }
                        .receipt-logo {
                            max-width: 80px;
                            max-height: 80px;
                            margin: 0 auto 6px auto;
                        }
                        table {
                            font-size: 9px;
                            border-spacing: 0;
                        }
                        th, td {
                            font-size: 9px;
                            padding: 1px 1px;
                            font-weight: 600 !important;
                            line-height: 1.2 !important;
                        }
                        .header-section, .report-info, .summary-section, .section-title {
                            font-weight: 600 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="separator"></div>
                    <div class="report-title">${reportLabel}</div>
                    <div class="separator"></div>
                    <div class="separator"></div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="separator"></div>
                </div>
                
                <div class="section-title">EMPLOYEES</div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Salary</th>
                            <th>Payouts</th>
                            <th>Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${employeeRows}
                    </tbody>
                </table>
                
                ${waiters.length > 0 ? `
                <div class="separator"></div>
                <div class="section-title">WAITERS</div>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Orders</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${waiterRows}
                    </tbody>
                </table>
                ` : ''}
                
                <div class="summary-section">
                    <div class="separator"></div>
                    <div style="font-weight: 700; margin: 4px 0;">Total Employees: ${filteredEmployees.length}</div>
                    ${filteredWaiters.length > 0 ? `<div style="font-weight: 700; margin: 4px 0;">Total Waiters: ${filteredWaiters.length}</div>` : ''}
                    <div style="margin: 4px 0;">Thank You!</div>
                    <div style="margin-top: 10px;"></div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

window.printSales = () => {
    const sales = Storage.get('sales') || [];
    const expenses = Storage.get('expenses') || [];

    // Get filter values (same as loadSales)
    const dateFilter = document.getElementById('salesDateFilter')?.value || 'all';
    const paymentFilter = document.getElementById('salesPaymentFilter')?.value || 'all';
    const sortFilter = document.getElementById('salesSortFilter')?.value || 'date-desc';

    // Group sales by orderId (same logic as loadSales)
    const orderMap = {};
    const ungroupedSales = [];

    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            const orderId = sale.orderId || sale.id;
            orderMap[orderId] = sale;
        } else {
            ungroupedSales.push(sale);
        }
    });

    const groupedByTime = {};
    ungroupedSales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const timeKey = Math.floor(saleDate.getTime() / 5000) * 5000;
        const groupKey = `${timeKey}-${(sale.paymentMethod || 'cash')}`;

        if (!groupedByTime[groupKey]) {
            groupedByTime[groupKey] = {
                id: `ORD-${timeKey}`,
                orderId: `ORD-${timeKey}`,
                date: sale.date,
                paymentMethod: sale.paymentMethod || 'cash',
                items: [],
                total: 0,
                subtotal: 0,
                tax: 0
            };
        }

        groupedByTime[groupKey].items.push({
            name: sale.itemName || sale.dishName || 'Unknown',
            quantity: sale.quantity,
            price: sale.price,
            total: sale.total
        });
        groupedByTime[groupKey].total += sale.total;
        groupedByTime[groupKey].subtotal += sale.total;
    });

    Object.values(groupedByTime).forEach(order => {
        order.tax = 0;
        order.total = order.subtotal;
        orderMap[order.orderId] = order;
    });

    let orders = Object.values(orderMap);

    // Prepare date objects for filtering
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Apply date filter to orders
    if (dateFilter !== 'all') {
        orders = orders.filter(order => {
            if (!order.date) return false;
            const orderDate = new Date(order.date);
            if (dateFilter === 'custom') {
                const startDate = document.getElementById('salesStartDate')?.value;
                const endDate = document.getElementById('salesEndDate')?.value;
                if (startDate || endDate) {
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (orderDate < start) return false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        if (orderDate > end) return false;
                    }
                    return true;
                }
                return false;
            } else if (dateFilter === 'today') {
                return orderDate >= today && orderDate <= todayEnd;
            } else if (dateFilter === 'week') {
                return orderDate >= weekAgo && orderDate <= todayEnd;
            } else if (dateFilter === 'month') {
                return orderDate >= monthAgo && orderDate <= todayEnd;
            } else if (dateFilter === 'specific-month') {
                const selectedMonth = document.getElementById('salesMonthFilter')?.value;
                if (selectedMonth) {
                    const [year, month] = selectedMonth.split('-').map(Number);
                    return orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month;
                }
                return true;
            }
            return true;
        });
    }

    // Filter expenses by the same date range
    let filteredExpenses = [...expenses];
    if (dateFilter !== 'all') {
        filteredExpenses = filteredExpenses.filter(exp => {
            if (!exp.date) return false;
            const expDate = new Date(exp.date);
            if (dateFilter === 'custom') {
                const startDate = document.getElementById('salesStartDate')?.value;
                const endDate = document.getElementById('salesEndDate')?.value;
                if (startDate || endDate) {
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (expDate < start) return false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        if (expDate > end) return false;
                    }
                    return true;
                }
                return false;
            } else if (dateFilter === 'today') {
                return expDate >= today && expDate <= todayEnd;
            } else if (dateFilter === 'week') {
                return expDate >= weekAgo && expDate <= todayEnd;
            } else if (dateFilter === 'month') {
                return expDate >= monthAgo && expDate <= todayEnd;
            } else if (dateFilter === 'specific-month') {
                const selectedMonth = document.getElementById('salesMonthFilter')?.value;
                if (selectedMonth) {
                    const [year, month] = selectedMonth.split('-').map(Number);
                    return expDate.getFullYear() === year && (expDate.getMonth() + 1) === month;
                }
                return true;
            }
            return true;
        });
    }

    // Apply payment method filter to orders (only if not 'all')
    if (paymentFilter !== 'all') {
        orders = orders.filter(order => {
            const method = (order.paymentMethod || 'cash').toLowerCase().trim();
            const filterValue = paymentFilter.toLowerCase().trim();
            return method === filterValue;
        });
    }

    // Calculate Global Totals
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalServiceCharges = orders.reduce((sum, order) => sum + (order.tax || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount?.amount || 0), 0);
    const totalSubtotal = orders.reduce((sum, order) => sum + (order.subtotal || order.total || 0), 0);
    const netSale = totalSales; // Net Sale now shows the total collected amount
    const avgSale = totalOrders > 0 ? totalSales / totalOrders : 0;
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const cashInHand = totalSales - totalExpenses;

    // Calculate Order Type Wise Metrics
    const getMetrics = (methodList) => {
        const filtered = orders.filter(o => methodList.includes((o.paymentMethod || 'cash').toLowerCase()));
        const count = filtered.length;
        const total = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
        const avg = count > 0 ? total / count : 0;
        return { count, total, avg };
    };

    const gents = getMetrics(['cash']);
    const family = getMetrics(['online']);
    const parcel = getMetrics(['delivery', 'parcel']);

    // Get filter labels for header
    let dateFilterLabel = 'All Time';
    if (dateFilter === 'today') dateFilterLabel = 'Today';
    else if (dateFilter === 'week') dateFilterLabel = 'Weekly';
    else if (dateFilter === 'month') dateFilterLabel = 'Monthly';
    else if (dateFilter === 'specific-month') {
        const selectedMonth = document.getElementById('salesMonthFilter')?.value;
        dateFilterLabel = selectedMonth ? `Month: ${selectedMonth}` : 'Specific Month';
    } else if (dateFilter === 'custom') dateFilterLabel = 'Custom';

    let locationFilterLabel = 'All';
    if (paymentFilter === 'cash') locationFilterLabel = 'Gents Hall';
    else if (paymentFilter === 'online') locationFilterLabel = 'Family Hall';
    else if (paymentFilter === 'delivery') locationFilterLabel = 'Parcel';

    const printWindow = window.open('', '_blank');
    const nowFull = new Date();
    const dateStr = nowFull.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = nowFull.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    printWindow.document.write(`
        <html>
            <head>
                <title>Sales Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 5px;
                        font-size: 12px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                        color: #000;
                        font-weight: 500;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 3px;
                        font-weight: 600;
                        width: 100%;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 800;
                        margin-bottom: 2px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 6px 0;
                        text-decoration: underline;
                    }
                    .report-info {
                        font-size: 11px;
                        margin: 1px 0;
                        font-weight: 500;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                        width: 100%;
                    }
                    .report-content {
                        width: 100%;
                        margin: 5px 0;
                    }
                    .report-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .section-title {
                        font-size: 13px;
                        font-weight: 700;
                        margin: 8px 0 4px 0;
                        text-align: left;
                        width: 100%;
                    }
                    .order-type-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 3px;
                        font-size: 11.5px;
                    }
                    .order-type-table th {
                        text-align: left;
                        border-bottom: 1px solid #000;
                        padding-bottom: 1px;
                        font-weight: 700;
                        font-size: 12px;
                    }
                    .order-type-table td {
                        padding: 3px 0;
                        font-weight: 500;
                    }
                    .order-type-table .text-right {
                        text-align: right;
                    }
                    @media print {
                        body {
                            padding: 3mm 0;
                            margin: 0;
                            max-width: 80mm;
                            font-size: 12px;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 3mm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="report-title">SALES REPORT</div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="report-info">Filter: ${dateFilterLabel} | ${locationFilterLabel}</div>
                    <div class="separator"></div>
                </div>

                <div class="report-content">
                    <div class="report-row"><span>Transactions:</span> <span>${totalOrders}</span></div>
                    <div class="report-row"><span>Cash:</span> <span>Rs.${formatNumber(totalSubtotal)}</span></div>
                    <div class="report-row"><span>Service Charges:</span> <span>Rs.${formatNumber(totalServiceCharges)}</span></div>
                    <div class="report-row"><span>Discount:</span> <span>${totalDiscount > 0 ? 'Rs.' + formatNumber(totalDiscount) : '0'}</span></div>
                    <div class="report-row"><span>Net Sale:</span> <span>Rs.${formatNumber(netSale)}</span></div>
                    <div class="report-row"><span>Average Sale:</span> <span>Rs.${formatNumber(Math.round(avgSale))}</span></div>
                    <div class="report-row"><span>Expenses:</span> <span>Rs.${formatNumber(totalExpenses)}</span></div>
                    <div class="report-row" style="border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
                        <span>Cash In Hand:</span> <span>Rs.${formatNumber(cashInHand)}</span>
                    </div>
                </div>

                <div class="separator"></div>
                <div class="section-title">Order Type Wise</div>

                <table class="order-type-table">
                    <thead>
                        <tr>
                            <th style="width: 30%">Location</th>
                            <th class="text-center" style="width: 20%">Bills</th>
                            <th class="text-right" style="width: 30%">Total</th>
                            <th class="text-right" style="width: 20%">Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Gents</td>
                            <td class="text-center">${gents.count}</td>
                            <td class="text-right">Rs.${formatNumber(gents.total)}</td>
                            <td class="text-right">Rs.${formatNumber(Math.round(gents.avg))}</td>
                        </tr>
                        <tr>
                            <td>Family</td>
                            <td class="text-center">${family.count}</td>
                            <td class="text-right">Rs.${formatNumber(family.total)}</td>
                            <td class="text-right">Rs.${formatNumber(Math.round(family.avg))}</td>
                        </tr>
                        <tr>
                            <td>Parcel</td>
                            <td class="text-center">${parcel.count}</td>
                            <td class="text-right">Rs.${formatNumber(parcel.total)}</td>
                            <td class="text-right">Rs.${formatNumber(Math.round(parcel.avg))}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="separator"></div>
                <div style="text-align: center; font-size: 10px; margin-top: 10px;">
                    Report Generated Successfully
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                    
                    // Close window when print dialog is cancelled or completed
                    window.addEventListener('afterprint', function() {
                        window.close();
                    });
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

window.printItemsSales = () => {
    const sales = Storage.get('sales') || [];

    // Get filter values (same as loadItemsSales)
    const dateFilter = document.getElementById('itemsSalesDateFilter')?.value || 'all';
    const sortFilter = document.getElementById('itemsSalesSortFilter')?.value || 'quantity-desc';
    const searchTerm = (document.getElementById('itemsSalesSearch')?.value || '').toLowerCase().trim();

    // Filter sales by date range (same logic as loadItemsSales)
    let filteredSales = [...sales];
    const now = new Date();

    if (dateFilter === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= today && saleDate <= todayEnd;
        });
    } else if (dateFilter === 'week') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        today.setHours(0, 0, 0, 0);
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= weekStart && saleDate <= weekEnd;
        });
    } else if (dateFilter === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= monthStart && saleDate <= monthEnd;
        });
    } else if (dateFilter === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        filteredSales = sales.filter(sale => {
            if (!sale.date) return false;
            const saleDate = new Date(sale.date);
            return saleDate >= yearStart && saleDate <= yearEnd;
        });
    }

    // Aggregate items from filtered sales (same logic as loadItemsSales)
    const itemMap = {};

    filteredSales.forEach(sale => {
        // Process items from this sale
        if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
                const itemName = item.name || 'Unknown';
                if (!itemMap[itemName]) {
                    itemMap[itemName] = {
                        name: itemName,
                        totalQuantity: 0,
                        totalRevenue: 0,
                        priceSum: 0,
                        priceCount: 0
                    };
                }

                const quantity = item.quantity || 0;
                const price = item.price || 0;
                const total = item.total || (price * quantity);

                itemMap[itemName].totalQuantity += quantity;
                itemMap[itemName].totalRevenue += total;
                itemMap[itemName].priceSum += price;
                itemMap[itemName].priceCount += 1;
            });
        } else {
            // Handle old format
            const itemName = sale.itemName || sale.dishName || 'Unknown';
            if (!itemMap[itemName]) {
                itemMap[itemName] = {
                    name: itemName,
                    totalQuantity: 0,
                    totalRevenue: 0,
                    priceSum: 0,
                    priceCount: 0
                };
            }

            const quantity = sale.quantity || 0;
            const price = sale.price || 0;
            const total = sale.total || (price * quantity);

            itemMap[itemName].totalQuantity += quantity;
            itemMap[itemName].totalRevenue += total;
            itemMap[itemName].priceSum += price;
            itemMap[itemName].priceCount += 1;
        }
    });

    // Convert to array and calculate averages
    let items = Object.values(itemMap).map(item => ({
        name: item.name,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue,
        averagePrice: item.priceCount > 0 ? item.priceSum / item.priceCount : 0
    }));

    // Apply search filter
    if (searchTerm) {
        items = items.filter(item =>
            item.name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply sorting
    if (sortFilter === 'quantity-desc') {
        items.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else if (sortFilter === 'quantity-asc') {
        items.sort((a, b) => a.totalQuantity - b.totalQuantity);
    } else if (sortFilter === 'revenue-desc') {
        items.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sortFilter === 'revenue-asc') {
        items.sort((a, b) => a.totalRevenue - b.totalRevenue);
    } else if (sortFilter === 'name-asc') {
        items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortFilter === 'name-desc') {
        items.sort((a, b) => b.name.localeCompare(a.name));
    }

    // Calculate totals
    const totalQuantity = items.reduce((sum, item) => sum + item.totalQuantity, 0);
    const totalRevenue = items.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalItems = items.length;

    // Get filter label
    let filterLabel = 'All Time';
    if (dateFilter === 'today') filterLabel = 'Daily';
    else if (dateFilter === 'week') filterLabel = 'Weekly';
    else if (dateFilter === 'month') filterLabel = 'Monthly';
    else if (dateFilter === 'year') filterLabel = 'Annual';
    else if (dateFilter === 'specific-month') {
        const selectedMonth = document.getElementById('itemsSalesMonthFilter')?.value;
        filterLabel = selectedMonth ? `Month: ${selectedMonth}` : 'Specific Month';
    }

    // Create receipt-style content for 80mm paper
    const nowDate = new Date();
    const dateStr = nowDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    // Build table HTML for items
    let tableRows = '';
    if (items.length === 0) {
        tableRows = '<tr><td colspan="4" style="text-align: center; padding: 10px;">No items sales data available</td></tr>';
    } else {
        items.forEach(item => {
            const itemName = escapeHtml(item.name);
            tableRows += `
                <tr>
                    <td style="text-align: left; padding: 1px 2px;">${itemName}</td>
                    <td style="text-align: right; padding: 1px 2px;">${formatQuantity(item.totalQuantity)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(item.averagePrice)}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(item.totalRevenue)}</td>
                </tr>
            `;
        });
    }

    // Build summary row
    const summaryRow = `
        <tr style="border-top: 2px solid #000; font-weight: 700;">
            <td style="text-align: left; padding: 2px 2px;">TOTAL</td>
            <td style="text-align: right; padding: 2px 2px;">-</td>
            <td style="text-align: right; padding: 2px 2px;">-</td>
            <td style="text-align: right; padding: 2px 2px;">Rs.${formatNumber(totalRevenue)}</td>
        </tr>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Items Sales Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 11px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 10px;
                        font-weight: bold;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 900;
                        margin-bottom: 4px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 8px 0;
                    }
                    .report-info {
                        font-size: 10px;
                        margin: 4px 0;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 8px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 8px 0;
                        font-size: 10px;
                    }
                    thead {
                        border-bottom: 2px solid #000;
                    }
                    th {
                        padding: 6px 2px;
                        text-align: left;
                        font-weight: 700;
                        font-size: 10px;
                    }
                    th:nth-child(2),
                    th:nth-child(3),
                    th:nth-child(4) {
                        text-align: right;
                    }
                    td {
                        padding: 2px 2px;
                        border-bottom: 1px dotted #ccc;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    td:nth-child(2),
                    td:nth-child(3),
                    td:nth-child(4) {
                        text-align: right;
                    }
                    .summary-section {
                        text-align: center;
                        margin-top: 10px;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    .header-section {
                        font-weight: 600;
                    }
                    .report-info {
                        font-weight: 600;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                            max-width: 80mm;
                        }
                        .receipt-logo {
                            max-width: 80px;
                            max-height: 80px;
                            margin: 0 auto 6px auto;
                        }
                        table {
                            font-size: 9px;
                            border-spacing: 0;
                        }
                        th, td {
                            font-size: 9px;
                            padding: 1px 1px;
                            font-weight: 600 !important;
                            line-height: 1.2 !important;
                        }
                        td {
                            border-bottom: 1px dotted #999;
                        }
                        .header-section, .report-info, .summary-section {
                            font-weight: 600 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="report-title">ITEMS SALES REPORT</div>
                    <div class="separator"></div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="report-info">Filter: ${filterLabel}</div>
                    <div class="separator"></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        ${summaryRow}
                    </tbody>
                </table>
                <div class="summary-section">
                    <div class="separator"></div>
                    <div style="font-weight: 700; margin: 4px 0;">Total Items: ${totalItems}</div>
                    <div style="margin: 4px 0;">Thank You!</div>
                    <div style="margin-top: 10px;"></div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

window.printExpenses = () => {
    const expenses = Storage.get('expenses') || [];
    const printWindow = window.open('', '_blank');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    // Get filter values (same as loadExpenses)
    const categoryFilter = document.getElementById('expenseCategoryFilter')?.value || 'all';
    const dateFilter = document.getElementById('expenseDateFilter')?.value || 'all';
    const startDate = document.getElementById('expenseStartDate')?.value;
    const endDate = document.getElementById('expenseEndDate')?.value;
    const searchQuery = document.getElementById('expenseSearch')?.value.trim().toLowerCase() || '';
    const sortFilter = document.getElementById('expenseSortFilter')?.value || 'date-desc';

    // Apply filters (same logic as loadExpenses)
    const nowFilter = new Date();
    const today = new Date(nowFilter.getFullYear(), nowFilter.getMonth(), nowFilter.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    let filteredExpenses = expenses.filter(exp => {
        const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
        const matchesSearch = !searchQuery ||
            (exp.title || '').toLowerCase().includes(searchQuery) ||
            (exp.category || '').toLowerCase().includes(searchQuery);

        let matchesDateRange = true;
        if (dateFilter === 'custom') {
            if (startDate || endDate) {
                const expDate = new Date(exp.date);
                expDate.setHours(0, 0, 0, 0);
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (expDate < start) matchesDateRange = false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (expDate > end) matchesDateRange = false;
                }
            }
        } else if (dateFilter === 'today') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate.getTime() === today.getTime();
        } else if (dateFilter === 'week') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate >= weekAgo && expDate <= todayEnd;
        } else if (dateFilter === 'month') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate >= monthAgo && expDate <= todayEnd;
        } else if (dateFilter === 'specific-month') {
            const selectedMonth = document.getElementById('expenseMonthFilter')?.value;
            if (selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number);
                const expDate = new Date(exp.date);
                matchesDateRange = expDate.getFullYear() === year && (expDate.getMonth() + 1) === month;
            }
        }

        return matchesCategory && matchesDateRange && matchesSearch;
    });

    // Apply sorting
    if (sortFilter === 'date-desc') {
        // Sort by expense date (not createdAt) - newest expense date first
        filteredExpenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            // If dates are the same, use createdAt as tiebreaker (newer entry first)
            if (dateA.getTime() === dateB.getTime()) {
                const createdA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const createdB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return createdB - createdA;
            }
            return dateB - dateA; // Latest expense date first
        });
    } else if (sortFilter === 'date-asc') {
        // Sort by expense date (not createdAt) - oldest expense date first
        filteredExpenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            // If dates are the same, use createdAt as tiebreaker (older entry first)
            if (dateA.getTime() === dateB.getTime()) {
                const createdA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const createdB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return createdA - createdB;
            }
            return dateA - dateB; // Oldest expense date first
        });
    } else if (sortFilter === 'amount-desc') {
        filteredExpenses.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else if (sortFilter === 'amount-asc') {
        filteredExpenses.sort((a, b) => (a.amount || 0) - (b.amount || 0));
    }

    // Calculate totals
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Get filter labels
    let dateFilterLabel = 'All Time';
    if (dateFilter === 'today') dateFilterLabel = 'Today';
    else if (dateFilter === 'week') dateFilterLabel = 'Weekly';
    else if (dateFilter === 'month') dateFilterLabel = 'Monthly';
    else if (dateFilter === 'specific-month') {
        const selectedMonth = document.getElementById('expenseMonthFilter')?.value;
        dateFilterLabel = selectedMonth ? `Month: ${selectedMonth}` : 'Specific Month';
    } else if (dateFilter === 'custom') dateFilterLabel = 'Custom';

    let categoryFilterLabel = 'All';
    if (categoryFilter !== 'all') {
        categoryFilterLabel = categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1);
    }

    // Build expense table rows
    let expenseRows = '';
    if (filteredExpenses.length === 0) {
        expenseRows = '<tr><td colspan="4" style="text-align: center; padding: 10px;">No expenses found</td></tr>';
    } else {
        filteredExpenses.forEach(exp => {
            const expenseDate = new Date(exp.date);
            const dateStr = formatDate(expenseDate);
            const title = escapeHtml(exp.title || 'N/A');
            const category = escapeHtml(exp.category || 'N/A');

            expenseRows += `
                <tr>
                    <td style="text-align: left; padding: 1px 2px; font-size: 8px;">${dateStr}</td>
                    <td style="text-align: left; padding: 1px 2px;">${title}</td>
                    <td style="text-align: left; padding: 1px 2px; font-size: 8px;">${category}</td>
                    <td style="text-align: right; padding: 1px 2px;">Rs.${formatNumber(exp.amount || 0)}</td>
                </tr>
            `;
        });
    }

    // Build summary row
    const summaryRow = `
        <tr style="border-top: 2px solid #000; font-weight: 700;">
            <td style="text-align: left; padding: 2px 2px;">TOTAL</td>
            <td style="text-align: left; padding: 2px 2px;">${filteredExpenses.length} Expenses</td>
            <td style="text-align: left; padding: 2px 2px;">-</td>
            <td style="text-align: right; padding: 2px 2px;">Rs.${formatNumber(totalExpenses)}</td>
        </tr>
    `;

    printWindow.document.write(`
        <html>
            <head>
                <title>Expenses Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 11px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 900;
                        margin-bottom: 4px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 8px 0;
                    }
                    .report-info {
                        font-size: 10px;
                        margin: 4px 0;
                        font-weight: 600;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                        font-size: 9px;
                    }
                    thead {
                        border-bottom: 2px solid #000;
                    }
                    th {
                        padding: 6px 2px;
                        text-align: left;
                        font-weight: 700;
                        font-size: 10px;
                    }
                    th:nth-child(4) {
                        text-align: right;
                    }
                    td {
                        padding: 2px 2px;
                        border-bottom: 1px dotted #ccc;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    td:nth-child(4) {
                        text-align: right;
                    }
                    .summary-section {
                        text-align: center;
                        margin-top: 8px;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                            max-width: 80mm;
                        }
                        .receipt-logo {
                            max-width: 80px;
                            max-height: 80px;
                            margin: 0 auto 6px auto;
                        }
                        table {
                            font-size: 9px;
                            border-spacing: 0;
                        }
                        th, td {
                            font-size: 9px;
                            padding: 1px 1px;
                            font-weight: 600 !important;
                            line-height: 1.2 !important;
                        }
                        .header-section, .report-info, .summary-section {
                            font-weight: 600 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="report-title">EXPENSES REPORT</div>
                    <div class="separator"></div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="report-info">Filter: ${dateFilterLabel} | ${categoryFilterLabel}</div>
                    <div class="separator"></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenseRows}
                        ${summaryRow}
                    </tbody>
                </table>
                <div class="summary-section">
                    <div class="separator"></div>
                    <div style="font-weight: 700; margin: 4px 0;">Total Expenses: Rs.${formatNumber(totalExpenses)}</div>
                    <div style="margin: 4px 0;">Thank You!</div>
                    <div style="margin-top: 10px;"></div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

// Expenses Management
let editingExpenseId = null;

// Initialize expense categories
function initializeExpenseCategories() {
    const categories = Storage.get('expenseCategories');
    if (!categories || categories.length === 0) {
        Storage.set('expenseCategories', ['kitchen', 'bill', 'factory']);
    }
}

// Category Management
const expenseCategoryForm = document.getElementById('expenseCategoryForm');
if (expenseCategoryForm) {
    expenseCategoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const categories = Storage.get('expenseCategories') || [];
        const categoryName = document.getElementById('newCategoryName').value.trim().toLowerCase();

        if (!categoryName) return;

        if (editingExpenseCategoryName !== null) {
            // Update existing category
            const oldName = editingExpenseCategoryName;
            const index = categories.indexOf(oldName);

            if (index !== -1 && categoryName !== oldName) {
                // Check if new name already exists
                if (categories.includes(categoryName)) {
                    alert('Category with this name already exists!');
                    return;
                }

                // Update category name
                categories[index] = categoryName;

                // Update all expenses with this category
                const expenses = Storage.get('expenses') || [];
                expenses.forEach(exp => {
                    if (exp.category === oldName) {
                        exp.category = categoryName;
                    }
                });
                Storage.set('expenses', expenses);
            }

            editingExpenseCategoryName = null;
        } else {
            // Add new category
            if (categories.includes(categoryName)) {
                alert('Category with this name already exists!');
                return;
            }
            categories.push(categoryName);
        }

        Storage.set('expenseCategories', categories);
        document.getElementById('newCategoryName').value = '';

        // Reset button text
        const submitButton = document.querySelector('#expenseCategoryForm button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = 'Add Category';
        }

        loadExpenseCategories();
        updateExpenseCategoryDropdown();
        loadExpenses(); // Refresh expenses to show updated category names
    });
}

let editingExpenseCategoryName = null;

function loadExpenseCategories() {
    const categories = Storage.get('expenseCategories') || [];
    const container = document.getElementById('expenseCategoriesList');
    if (!container) return;

    container.innerHTML = '';

    if (categories.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No categories found</div>';
        return;
    }

    categories.forEach(category => {
        const categoryRow = document.createElement('div');
        categoryRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 15px; background: #f8f8f8; border-radius: 6px; border: 1px solid #e0e0e0;';
        categoryRow.innerHTML = `
            <span style="font-weight: 600; color: #333; text-transform: capitalize; flex: 1;">${category}</span>
            <div style="display: flex; gap: 8px;">
                <button onclick="editExpenseCategory('${category}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button onclick="deleteExpenseCategory('${category}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        container.appendChild(categoryRow);
    });
}

window.editExpenseCategory = (categoryName) => {
    editingExpenseCategoryName = categoryName;
    document.getElementById('newCategoryName').value = categoryName;
    document.getElementById('newCategoryName').focus();

    // Change button text
    const submitButton = document.querySelector('#expenseCategoryForm button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'Update Category';
    }
};

window.deleteExpenseCategory = (category, buttonElement) => {
    if (buttonElement) {
        showDeleteConfirmation(buttonElement, deleteExpenseCategoryConfirmed, category);
        return;
    }
    deleteExpenseCategoryConfirmed(category);
};

function deleteExpenseCategoryConfirmed(category) {
    const categories = Storage.get('expenseCategories') || [];
    const filtered = categories.filter(cat => cat !== category);
    Storage.set('expenseCategories', filtered);
    loadExpenseCategories();
    updateExpenseCategoryDropdown();
}

function updateExpenseCategoryDropdown() {
    const categories = Storage.get('expenseCategories') || [];
    const select = document.getElementById('expenseCategory');
    const filterSelect = document.getElementById('expenseCategoryFilter');

    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Category</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            select.appendChild(option);
        });
        if (currentValue && categories.includes(currentValue)) {
            select.value = currentValue;
        }
    }

    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            filterSelect.appendChild(option);
        });
        if (currentValue && (currentValue === 'all' || categories.includes(currentValue))) {
            filterSelect.value = currentValue;
        }
    }
}

const expenseForm = document.getElementById('expenseForm');
if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const expenses = Storage.get('expenses') || [];
        const date = document.getElementById('expenseDate').value;
        const category = document.getElementById('expenseCategory').value.trim().toLowerCase();
        const title = document.getElementById('expenseTitle').value.trim();
        const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;

        if (editingExpenseId !== null) {
            const index = expenses.findIndex(exp => exp.id === editingExpenseId);
            if (index !== -1) {
                const existingExpense = expenses[index];
                expenses[index] = {
                    id: editingExpenseId,
                    date,
                    category,
                    title,
                    amount,
                    createdAt: existingExpense.createdAt || (existingExpense.id && typeof existingExpense.id === 'number' && existingExpense.id > 1000000000000 ? new Date(existingExpense.id).toISOString() : new Date().toISOString())
                };
            }
            editingExpenseId = null;
        } else {
            const now = new Date();
            const newExpense = {
                id: Date.now(),
                date,
                category,
                title,
                amount,
                createdAt: now.toISOString()
            };
            expenses.push(newExpense);
        }

        Storage.set('expenses', expenses);
        document.getElementById('expenseForm').reset();
        closeAddExpenseModal();
        loadExpenses();
    });
}

window.loadExpenses = function loadExpenses() {
    const expenses = Storage.get('expenses') || [];
    const tbody = document.getElementById('expenseTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get filter values
    const categoryFilter = document.getElementById('expenseCategoryFilter')?.value || 'all';
    const dateFilter = document.getElementById('expenseDateFilter')?.value || 'all';
    const startDate = document.getElementById('expenseStartDate')?.value;
    const endDate = document.getElementById('expenseEndDate')?.value;
    const searchQuery = document.getElementById('expenseSearch')?.value.trim().toLowerCase() || '';

    // Update category filter dropdown
    updateExpenseCategoryDropdown();

    // Calculate summary totals
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const todayExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate.getTime() === today.getTime();
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const weekExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= weekAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const monthExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= monthAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Update summary cards
    const expensesTodayEl = document.getElementById('expensesToday');
    const expensesWeekEl = document.getElementById('expensesWeek');
    const expensesMonthEl = document.getElementById('expensesMonth');

    if (expensesTodayEl) expensesTodayEl.textContent = `Rs. ${formatNumber(todayExpenses)}`;
    if (expensesWeekEl) expensesWeekEl.textContent = `Rs. ${formatNumber(weekExpenses)}`;
    if (expensesMonthEl) expensesMonthEl.textContent = `Rs. ${formatNumber(monthExpenses)}`;

    // Apply filters
    let filteredExpenses = expenses.filter(exp => {
        const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;

        // Search filter
        const matchesSearch = !searchQuery ||
            (exp.title || '').toLowerCase().includes(searchQuery) ||
            (exp.category || '').toLowerCase().includes(searchQuery);

        let matchesDateRange = true;

        // Handle date filter dropdown
        if (dateFilter === 'custom') {
            // Custom date range
            if (startDate || endDate) {
                const expDate = new Date(exp.date);
                expDate.setHours(0, 0, 0, 0);
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (expDate < start) matchesDateRange = false;
                }
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (expDate > end) matchesDateRange = false;
                }
            }
        } else if (dateFilter === 'today') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate.getTime() === today.getTime();
        } else if (dateFilter === 'week') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate >= weekAgo && expDate <= todayEnd;
        } else if (dateFilter === 'month') {
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            matchesDateRange = expDate >= monthAgo && expDate <= todayEnd;
        } else if (dateFilter === 'specific-month') {
            const selectedMonth = document.getElementById('expenseMonthFilter')?.value;
            if (selectedMonth) {
                const [year, month] = selectedMonth.split('-').map(Number);
                const expDate = new Date(exp.date);
                matchesDateRange = expDate.getFullYear() === year && (expDate.getMonth() + 1) === month;
            }
        }

        // 'all' or other values - no date filtering

        return matchesCategory && matchesDateRange && matchesSearch;
    });

    // Get sort filter
    const sortFilter = document.getElementById('expenseSortFilter')?.value || 'date-desc';

    // Apply sorting
    if (sortFilter === 'date-desc') {
        // Sort by expense date (not createdAt) - newest expense date first
        filteredExpenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            // If dates are the same, use createdAt as tiebreaker (newer entry first)
            if (dateA.getTime() === dateB.getTime()) {
                const createdA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const createdB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return createdB - createdA;
            }
            return dateB - dateA; // Latest expense date first
        });
    } else if (sortFilter === 'date-asc') {
        // Sort by expense date (not createdAt) - oldest expense date first
        filteredExpenses.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            // If dates are the same, use createdAt as tiebreaker (older entry first)
            if (dateA.getTime() === dateB.getTime()) {
                const createdA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const createdB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return createdA - createdB;
            }
            return dateA - dateB; // Oldest expense date first
        });
    } else if (sortFilter === 'amount-desc') {
        filteredExpenses.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    } else if (sortFilter === 'amount-asc') {
        filteredExpenses.sort((a, b) => (a.amount || 0) - (b.amount || 0));
    }

    // Calculate total expenses
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalExpensesEl = document.getElementById('totalExpensesAmount');
    if (totalExpensesEl) totalExpensesEl.textContent = `Rs. ${formatNumber(totalExpenses)}`;

    if (filteredExpenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">No expenses found</td></tr>';
        return;
    }

    // Category colors for tags
    const categories = Storage.get('expenseCategories') || [];
    const categoryColors = ['#e91e63', '#9c27b0', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336'];
    const colorMap = {};
    categories.forEach((cat, index) => {
        colorMap[cat] = categoryColors[index % categoryColors.length];
    });

    filteredExpenses.forEach(expense => {
        const tr = document.createElement('tr');
        const expenseDate = new Date(expense.date);
        const dateStr = formatDate(expenseDate);

        // Get time from createdAt if available, otherwise derive from id (timestamp)
        let timeStr = '';
        if (expense.createdAt) {
            timeStr = formatTime(new Date(expense.createdAt));
        } else if (expense.id && typeof expense.id === 'number' && expense.id > 1000000000000) {
            // id is a timestamp (milliseconds since epoch)
            timeStr = formatTime(new Date(expense.id));
        } else {
            // Default to current time if no timestamp available
            timeStr = formatTime(new Date());
        }

        const dateTimeStr = `${dateStr} ${timeStr}`;
        const categoryColor = colorMap[expense.category] || '#999';

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600; color: #333;">${expense.title || 'Untitled'}</div>
            </td>
            <td style="font-weight: 700; color: #1e3a5f;">Rs. ${formatNumber(expense.amount || 0)}</td>
            <td>
                <span style="background: ${categoryColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize;">${expense.category || 'uncategorized'}</span>
            </td>
            <td>${dateTimeStr}</td>
            <td>
                <button class="btn-edit" onclick="editExpense(${expense.id})" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteExpense(${expense.id}, this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.toggleExpenseCategories = () => {
    loadExpenseCategories();
    document.getElementById('expenseCategoryModal').style.display = 'flex';
};

window.closeExpenseCategoryModal = () => {
    document.getElementById('expenseCategoryModal').style.display = 'none';
    document.getElementById('expenseCategoryForm').reset();
    editingExpenseCategoryName = null;

    // Reset button text
    const submitButton = document.querySelector('#expenseCategoryForm button[type="submit"]');
    if (submitButton) {
        submitButton.textContent = 'Add Category';
    }
};

window.openAddExpenseModal = () => {
    editingExpenseId = null;
    document.getElementById('expenseModalTitle').textContent = 'Add Expense';
    document.getElementById('expenseForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
    updateExpenseCategoryDropdown();
    document.getElementById('addExpenseModal').style.display = 'flex';
};

window.closeAddExpenseModal = () => {
    editingExpenseId = null;
    document.getElementById('expenseForm').reset();
    document.getElementById('addExpenseModal').style.display = 'none';
};

window.editExpense = (id) => {
    // Require password before editing
    openActionPasswordModal(() => {
        const expenses = Storage.get('expenses') || [];
        const expense = expenses.find(exp => exp.id === id);
        if (expense) {
            editingExpenseId = id;
            document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
            document.getElementById('expenseDate').value = expense.date;
            document.getElementById('expenseCategory').value = expense.category;
            document.getElementById('expenseTitle').value = expense.title || '';
            document.getElementById('expenseAmount').value = expense.amount || '';
            updateExpenseCategoryDropdown();
            document.getElementById('addExpenseModal').style.display = 'flex';
        } else {
            alert('Expense not found!');
        }
    });
};

window.deleteExpense = (id, buttonElement) => {
    // Require password before deleting
    openActionPasswordModal(() => {
        // Re-find button element after password verification (in case DOM changed)
        if (!buttonElement) {
            const expenseTable = document.getElementById('expenseTableBody');
            if (expenseTable) {
                const rows = expenseTable.querySelectorAll('tr');
                for (let row of rows) {
                    const deleteBtn = row.querySelector(`button[onclick*="deleteExpense(${id}"]`);
                    if (deleteBtn) {
                        buttonElement = deleteBtn;
                        break;
                    }
                }
            }
        }

        if (buttonElement) {
            showDeleteConfirmation(buttonElement, deleteExpenseConfirmed, id);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteExpenseConfirmed(id);
        }
    });
};

function deleteExpenseConfirmed(id) {
    const expenses = Storage.get('expenses') || [];
    const filtered = expenses.filter(exp => exp.id !== id);
    Storage.set('expenses', filtered);
    loadExpenses();
}

// Stock Management
let editingStockId = null;

window.loadStock = function loadStock() {
    const stocks = Storage.get('stocks') || [];
    const tbody = document.getElementById('stockTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Get search query
    const searchQuery = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();

    // Filter stocks based on search
    let filteredStocks = stocks;
    if (searchQuery) {
        filteredStocks = stocks.filter(stock =>
            (stock.itemName || '').toLowerCase().includes(searchQuery) ||
            (stock.unit || '').toLowerCase().includes(searchQuery)
        );
    }

    // Apply sorting
    const sortFilter = document.getElementById('stockSortFilter')?.value || 'name-asc';
    filteredStocks = [...filteredStocks].sort((a, b) => {
        const qtyA = parseFloat(a.quantity || 0);
        const qtyB = parseFloat(b.quantity || 0);
        const priceA = parseFloat(a.unitPrice || 0);
        const priceB = parseFloat(b.unitPrice || 0);
        const valueA = qtyA * priceA;
        const valueB = qtyB * priceB;

        switch (sortFilter) {
            case 'name-asc':
                return (a.itemName || '').localeCompare(b.itemName || '');
            case 'name-desc':
                return (b.itemName || '').localeCompare(a.itemName || '');
            case 'quantity-asc':
                return qtyA - qtyB;
            case 'quantity-desc':
                return qtyB - qtyA;
            case 'price-asc':
                return priceA - priceB;
            case 'price-desc':
                return priceB - priceA;
            case 'value-asc':
                return valueA - valueB;
            case 'value-desc':
                return valueB - valueA;
            default:
                return 0;
        }
    });

    if (filteredStocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No stock items found. Add a stock item to get started.</td></tr>';

        // Update summary
        updateStockSummary(stocks);
        return;
    }

    filteredStocks.forEach(stock => {
        const tr = document.createElement('tr');
        const quantity = parseFloat(stock.quantity || 0);
        const unitPrice = parseFloat(stock.unitPrice || 0);
        const totalValue = quantity * unitPrice;
        const minLevel = parseFloat(stock.minLevel || 0);
        const isOutOfStock = quantity <= 0;
        const isLowStock = !isOutOfStock && minLevel > 0 && quantity <= minLevel;

        // Determine status text and styling
        let statusText, statusStyle;
        if (isOutOfStock) {
            statusText = 'Out of Stock';
            statusStyle = 'background: #f8d7da; color: #721c24;';
        } else if (isLowStock) {
            statusText = 'Low Stock';
            statusStyle = 'background: #fff3cd; color: #856404;';
        } else {
            statusText = 'In Stock';
            statusStyle = 'background: #d4edda; color: #155724;';
        }

        tr.innerHTML = `
            <td style="padding: 12px; font-weight: 600; color: #333;">${escapeHtml(stock.itemName || 'N/A')}</td>
            <td style="padding: 12px; text-align: right; color: #333;">${formatQuantity(quantity)}</td>
            <td style="padding: 12px; color: #666;">${escapeHtml(stock.unit || 'N/A')}</td>
            <td style="padding: 12px; text-align: right; color: #333;">Rs. ${formatNumber(unitPrice)}</td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #2c3e50;">Rs. ${formatNumber(totalValue)}</td>
            <td style="padding: 12px; text-align: right; color: #666;">${minLevel > 0 ? formatNumber(minLevel) : '-'}</td>
            <td style="padding: 12px; text-align: center;">
                <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${statusStyle}">
                    ${statusText}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="editStock('${stock.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                </button>
                <button onclick="deleteStock('${stock.id}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update summary
    updateStockSummary(stocks);

    // Setup search functionality
    const searchInput = document.getElementById('stockSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            loadStock();
        });
    }
};

function updateStockSummary(stocks) {
    const totalItems = stocks.length;
    const totalValue = stocks.reduce((sum, stock) => {
        const quantity = parseFloat(stock.quantity || 0);
        const unitPrice = parseFloat(stock.unitPrice || 0);
        return sum + (quantity * unitPrice);
    }, 0);

    const lowStockCount = stocks.filter(stock => {
        const quantity = parseFloat(stock.quantity || 0);
        const minLevel = parseFloat(stock.minLevel || 0);
        return minLevel > 0 && quantity <= minLevel;
    }).length;

    const totalItemsEl = document.getElementById('totalStockItems');
    const totalValueEl = document.getElementById('totalStockValue');
    const lowStockEl = document.getElementById('lowStockItems');

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (totalValueEl) totalValueEl.textContent = `Rs. ${formatNumber(totalValue)}`;
    if (lowStockEl) lowStockEl.textContent = lowStockCount;
}

window.openAddStockModal = function openAddStockModal() {
    editingStockId = null;
    const form = document.getElementById('stockForm');
    const modalTitle = document.getElementById('stockModalTitle');

    if (form) form.reset();
    if (modalTitle) modalTitle.textContent = 'Add Stock Item';

    // Populate menu items dropdown
    populateStockMenuItemDropdown();

    document.getElementById('addStockModal').style.display = 'flex';
};

window.closeAddStockModal = function closeAddStockModal() {
    document.getElementById('addStockModal').style.display = 'none';
    const form = document.getElementById('stockForm');
    if (form) form.reset();
    editingStockId = null;
};

window.editStock = function editStock(id) {
    openActionPasswordModal(() => {
        const stocks = Storage.get('stocks') || [];
        const stock = stocks.find(s => s.id === id);

        if (!stock) {
            alert('Stock item not found!');
            return;
        }

        editingStockId = id;
        const form = document.getElementById('stockForm');
        const modalTitle = document.getElementById('stockModalTitle');

        if (modalTitle) modalTitle.textContent = 'Edit Stock Item';

        // Populate menu items dropdown first
        populateStockMenuItemDropdown(() => {
            // Then set the selected value
            const itemNameSelect = document.getElementById('stockItemName');
            if (itemNameSelect && stock.itemName) {
                // Find the option that matches the stock item name
                const options = itemNameSelect.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === stock.itemName) {
                        itemNameSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        });

        document.getElementById('stockQuantity').value = stock.quantity || 0;
        document.getElementById('stockUnit').value = stock.unit || 'kg';
        document.getElementById('stockUnitPrice').value = stock.unitPrice || 0;
        document.getElementById('stockMinLevel').value = stock.minLevel || 0;

        document.getElementById('addStockModal').style.display = 'flex';
    });
};

window.deleteStock = function deleteStock(id, buttonElement) {
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement || !btnElement.parentElement || !document.contains(buttonElement)) {
            // Try to find the button in the DOM by looking for the stock row
            const stockRows = document.querySelectorAll('#stockTableBody tr');
            for (let row of stockRows) {
                if (row.getAttribute('data-stock-id') === id) {
                    const deleteBtn = row.querySelector('button[onclick*="deleteStock"]');
                    if (deleteBtn) {
                        btnElement = deleteBtn;
                        break;
                    }
                }
            }
        }

        if (btnElement) {
            showDeleteConfirmation(btnElement, deleteStockConfirmed, id);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteStockConfirmed(id);
        }
    });
};

function deleteStockConfirmed(id) {
    const stocks = Storage.get('stocks') || [];
    const filtered = stocks.filter(s => s.id !== id);
    Storage.set('stocks', filtered);
    loadStock();
}

// Populate the menu items dropdown in stock form
function populateStockMenuItemDropdown(callback) {
    const itemNameSelect = document.getElementById('stockItemName');
    if (!itemNameSelect) {
        if (callback) callback();
        return;
    }

    // Get all menu items
    const menuItems = Storage.get('menuItems') || [];

    // Get all existing stock items (for backward compatibility - include stock items that might not be in menu items)
    const stocks = Storage.get('stocks') || [];
    const existingStockNames = new Set(stocks.map(s => s.itemName).filter(Boolean));

    // Create a set of menu item names
    const menuItemNames = new Set(menuItems.map(item => item.name).filter(Boolean));

    // Combine menu items and existing stock items (to handle legacy data)
    const allItemNames = new Set([...menuItemNames, ...existingStockNames]);

    // Clear existing options except the first one
    itemNameSelect.innerHTML = '<option value="">Select a menu item</option>';

    // Sort items by name for better UX
    const sortedNames = Array.from(allItemNames).sort((a, b) => {
        const nameA = a.toLowerCase();
        const nameB = b.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Add items as options
    sortedNames.forEach(itemName => {
        const option = document.createElement('option');
        option.value = itemName;
        option.textContent = itemName;
        itemNameSelect.appendChild(option);
    });

    if (callback) callback();
}

// Automatically create stock item when a menu item is added
function createStockItemForMenuItem(itemName) {
    if (!itemName) return;

    const stocks = Storage.get('stocks') || [];

    // Check if stock item with this name already exists
    const existingStock = stocks.find(s => s.itemName && s.itemName.toLowerCase() === itemName.toLowerCase());
    if (existingStock) {
        // Stock item already exists, don't create duplicate
        return;
    }

    // Create new stock item with default values
    const newStock = {
        id: `STOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        itemName: itemName,
        quantity: 0, // Default quantity
        unit: 'pcs', // Default unit
        unitPrice: 0, // Default unit price
        minLevel: 0, // Default min level
        createdAt: new Date().toISOString()
    };

    stocks.push(newStock);
    Storage.set('stocks', stocks);

    // Refresh stock list if on stock tab
    if (document.getElementById('stock')?.classList.contains('active')) {
        loadStock();
    }
}

// Load all menu items into stock (skip existing items)
window.loadMenuItemsToStock = function loadMenuItemsToStock() {
    const menuItems = Storage.get('menuItems') || [];
    const stocks = Storage.get('stocks') || [];

    if (menuItems.length === 0) {
        const loadMenuBtn = document.querySelector('button[onclick="loadMenuItemsToStock()"]');
        if (loadMenuBtn) {
            // Remove any existing message
            const existingMessage = document.querySelector('.load-menu-message');
            if (existingMessage) {
                existingMessage.remove();
            }

            // Create message element
            const messageEl = document.createElement('div');
            messageEl.className = 'load-menu-message';
            messageEl.textContent = 'No menu items found!';
            messageEl.style.cssText = `
                position: fixed;
                background: #e74c3c;
                color: white;
                padding: 10px 18px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                white-space: nowrap;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
                pointer-events: none;
                font-family: 'Poppins', 'Inter', sans-serif;
            `;

            // Position message below the button
            const buttonRect = loadMenuBtn.getBoundingClientRect();
            messageEl.style.top = `${buttonRect.bottom + 10}px`;
            messageEl.style.left = `${buttonRect.left + (buttonRect.width / 2)}px`;
            messageEl.style.transform = 'translateX(-50%)';

            document.body.appendChild(messageEl);

            // Function to remove the message
            const removeMessage = () => {
                if (messageEl.parentElement) {
                    messageEl.remove();
                }
            };

            // Remove message when clicking anywhere
            const clickHandler = (e) => {
                if (!messageEl.contains(e.target)) {
                    removeMessage();
                    document.removeEventListener('click', clickHandler);
                }
            };

            // Add click listener after a small delay to avoid immediate removal
            setTimeout(() => {
                document.addEventListener('click', clickHandler);
            }, 10);

            // Remove message after 3 seconds
            setTimeout(() => {
                removeMessage();
                document.removeEventListener('click', clickHandler);
            }, 3000);
        }
        return;
    }

    let loadedCount = 0;
    let skippedCount = 0;

    menuItems.forEach(menuItem => {
        const itemName = menuItem.name || menuItem.dishName;
        if (!itemName) return;

        // Check if stock item with this name already exists (case-insensitive)
        const existingStock = stocks.find(s => s.itemName && s.itemName.toLowerCase() === itemName.toLowerCase());

        if (existingStock) {
            // Stock item already exists, skip it
            skippedCount++;
            return;
        }

        // Create new stock item
        const newStock = {
            id: `STOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            itemName: itemName,
            quantity: 0, // Default quantity
            unit: 'pcs', // Default unit
            unitPrice: menuItem.price || 0, // Use menu item price
            minLevel: 0, // Default min level
            createdAt: new Date().toISOString()
        };

        stocks.push(newStock);
        loadedCount++;
    });

    // Save updated stock list
    Storage.set('stocks', stocks);

    // Reload stock display
    loadStock();

    // Show success message below the Load Menu button
    const loadMenuBtn = document.querySelector('button[onclick="loadMenuItemsToStock()"]');
    if (loadMenuBtn) {
        // Remove any existing message
        const existingMessage = document.querySelector('.load-menu-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = 'load-menu-message';
        messageEl.textContent = `Loaded ${loadedCount} item${loadedCount !== 1 ? 's' : ''}!`;
        messageEl.style.cssText = `
            position: fixed;
            background: #e74c3c;
            color: white;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            white-space: nowrap;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
            pointer-events: none;
            font-family: 'Poppins', 'Inter', sans-serif;
        `;

        // Position message below the button
        const buttonRect = loadMenuBtn.getBoundingClientRect();
        messageEl.style.top = `${buttonRect.bottom + 10}px`;
        messageEl.style.left = `${buttonRect.left + (buttonRect.width / 2)}px`;
        messageEl.style.transform = 'translateX(-50%)';

        document.body.appendChild(messageEl);

        // Function to remove the message
        const removeMessage = () => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        };

        // Remove message when clicking anywhere
        const clickHandler = (e) => {
            if (!messageEl.contains(e.target)) {
                removeMessage();
                document.removeEventListener('click', clickHandler);
            }
        };

        // Add click listener after a small delay to avoid immediate removal
        setTimeout(() => {
            document.addEventListener('click', clickHandler);
        }, 10);

        // Remove message after 1 second
        setTimeout(() => {
            removeMessage();
            document.removeEventListener('click', clickHandler);
        }, 1000);
    }
};

// Update stock quantities when a sale is made
function updateStockFromSale(items) {
    if (!items || !Array.isArray(items)) return;

    const stocks = Storage.get('stocks') || [];
    let stockUpdated = false;

    items.forEach(saleItem => {
        const itemName = saleItem.name;
        const quantity = saleItem.quantity || 0;

        if (!itemName || quantity <= 0) return;

        // Find stock item by name (case-insensitive)
        const stockItem = stocks.find(s => s.itemName && s.itemName.toLowerCase() === itemName.toLowerCase());

        if (stockItem) {
            // Subtract the sold quantity from stock
            const currentQuantity = parseFloat(stockItem.quantity) || 0;
            stockItem.quantity = Math.max(0, currentQuantity - quantity);
            stockItem.updatedAt = new Date().toISOString();
            stockUpdated = true;
        }
    });

    if (stockUpdated) {
        Storage.set('stocks', stocks);

        // Refresh stock list if on stock tab
        if (document.getElementById('stock')?.classList.contains('active')) {
            loadStock();
        }
    }
}

// Handle stock form submission
document.addEventListener('DOMContentLoaded', () => {
    const stockForm = document.getElementById('stockForm');
    if (stockForm) {
        // Auto-populate price when menu item is selected
        const stockItemNameSelect = document.getElementById('stockItemName');
        if (stockItemNameSelect) {
            stockItemNameSelect.addEventListener('change', (e) => {
                const selectedItemName = e.target.value.trim();
                if (selectedItemName) {
                    // Find the menu item by name
                    const menuItems = Storage.get('menuItems') || [];
                    const menuItem = menuItems.find(item => item.name === selectedItemName);

                    if (menuItem && menuItem.price) {
                        // Auto-populate the unit price with the menu item's price
                        const stockUnitPriceInput = document.getElementById('stockUnitPrice');
                        if (stockUnitPriceInput) {
                            stockUnitPriceInput.value = menuItem.price;
                        }
                    }
                }
            });
        }

        stockForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const stocks = Storage.get('stocks') || [];
            const itemName = document.getElementById('stockItemName').value.trim();
            const quantity = parseFloat(document.getElementById('stockQuantity').value) || 0;
            const unit = document.getElementById('stockUnit').value;
            const unitPrice = parseFloat(document.getElementById('stockUnitPrice').value) || 0;
            const minLevel = parseFloat(document.getElementById('stockMinLevel').value) || 0;

            if (!itemName) {
                alert('Please select a menu item');
                return;
            }

            if (editingStockId) {
                // Update existing stock
                const index = stocks.findIndex(s => s.id === editingStockId);
                if (index !== -1) {
                    stocks[index] = {
                        ...stocks[index],
                        itemName,
                        quantity,
                        unit,
                        unitPrice,
                        minLevel,
                        updatedAt: new Date().toISOString()
                    };
                }
            } else {
                // Check if stock item with this name already exists
                const existingStock = stocks.find(s => s.itemName && s.itemName.toLowerCase() === itemName.toLowerCase());
                if (existingStock) {
                    const saveButton = stockForm.querySelector('button[type="submit"]');
                    if (saveButton) {
                        showButtonMessage(saveButton, 'Already Exists');
                    }
                    return;
                }

                // Add new stock
                const newStock = {
                    id: `STOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    itemName,
                    quantity,
                    unit,
                    unitPrice,
                    minLevel,
                    createdAt: new Date().toISOString()
                };
                stocks.push(newStock);
            }

            Storage.set('stocks', stocks);
            loadStock();
            closeAddStockModal();
        });
    }
});

// Table Management
let editingTableId = null;
let currentBookingTableId = null;
let tablesFilter = 'all';

const tableColors = ['#4a90e2', '#4caf50', '#ff9800', '#9c27b0', '#f44336', '#00bcd4', '#795548', '#607d8b'];

// Dynamic date/week utility helpers
function getISOWeekString(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const pad = (val) => String(val).padStart(2, '0');
    return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
}

function getISOWeekAndYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
}

function isOrderInTableTimeFilter(orderDateStr, filterType, filterValue) {
    if (!orderDateStr) return false;
    
    const orderDate = new Date(orderDateStr);
    if (isNaN(orderDate.getTime())) return false;
    
    if (filterType === 'alltime' || !filterValue) {
        return true;
    }
    
    const yearStr = orderDateStr.substring(0, 4); // "YYYY"
    const monthStr = orderDateStr.substring(0, 7); // "YYYY-MM"
    const dayStr = orderDateStr.substring(0, 10); // "YYYY-MM-DD"
    
    if (filterType === 'daily') {
        return dayStr === filterValue;
    }
    
    if (filterType === 'weekly') {
        const match = filterValue.match(/^(\d{4})-W(\d{1,2})$/);
        if (match) {
            const targetYear = parseInt(match[1], 10);
            const targetWeek = parseInt(match[2], 10);
            const { year, week } = getISOWeekAndYear(orderDate);
            return year === targetYear && week === targetWeek;
        }
        return false;
    }
    
    if (filterType === 'monthly') {
        return monthStr === filterValue;
    }
    
    if (filterType === 'annual') {
        return yearStr === String(filterValue);
    }
    
    return false;
}

window.handleTableTimeFilterTypeChange = function() {
    const filterType = document.getElementById('tableTimeFilterType').value;
    const container = document.getElementById('tableTimeValueContainer');
    if (!container) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const monthStr = todayStr.substring(0, 7);
    const currentWeekStr = getISOWeekString(now);

    container.innerHTML = '';

    if (filterType === 'daily') {
        container.innerHTML = `
            <label style="font-size: 12px; font-weight: 600; color: #4b5563; font-family: 'Inter', sans-serif;">Select Date</label>
            <input type="date" id="tableTimeDateInput" value="${todayStr}" onchange="loadTables()" style="padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; height: 38px;">
        `;
    } else if (filterType === 'weekly') {
        container.innerHTML = `
            <label style="font-size: 12px; font-weight: 600; color: #4b5563; font-family: 'Inter', sans-serif;">Select Week</label>
            <input type="week" id="tableTimeWeekInput" value="${currentWeekStr}" onchange="loadTables()" style="padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; height: 38px;">
        `;
    } else if (filterType === 'monthly') {
        container.innerHTML = `
            <label style="font-size: 12px; font-weight: 600; color: #4b5563; font-family: 'Inter', sans-serif;">Select Month</label>
            <input type="month" id="tableTimeMonthInput" value="${monthStr}" onchange="loadTables()" style="padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif; height: 38px;">
        `;
    } else if (filterType === 'annual') {
        let yearOptions = '';
        const currentYear = now.getFullYear();
        for (let y = currentYear - 5; y <= currentYear + 5; y++) {
            yearOptions += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
        }
        container.innerHTML = `
            <label style="font-size: 12px; font-weight: 600; color: #4b5563; font-family: 'Inter', sans-serif;">Select Year</label>
            <select id="tableTimeYearInput" onchange="loadTables()" style="padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; background: white; font-family: 'Inter', sans-serif; height: 38px; cursor: pointer;">
                ${yearOptions}
            </select>
        `;
    }

    loadTables();
};

function toggleOrdersRow(tableId, parentTr) {
    const detailRow = document.getElementById(`orders-row-${tableId}`);
    if (!detailRow) return;

    const isVisible = detailRow.style.display !== 'none';
    const toggleCell = parentTr.querySelector('.expand-toggle');

    if (isVisible) {
        detailRow.style.display = 'none';
        if (toggleCell) toggleCell.innerHTML = '&#9654;'; // ▶
    } else {
        detailRow.style.display = 'table-row';
        if (toggleCell) toggleCell.innerHTML = '&#9660;'; // ▼
    }
}

function loadTables() {
    let tables = Storage.get('tables') || [];
    // Normalize legacy table ids (number -> string) so actions keep working
    let tablesChanged = false;
    if (Array.isArray(tables)) {
        tables.forEach((t, idx) => {
            if (!t) return;
            if (t.id === undefined || t.id === null || t.id === '') {
                t.id = `${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`;
                tablesChanged = true;
            } else if (typeof t.id !== 'string') {
                t.id = String(t.id);
                tablesChanged = true;
            }
        });
        if (tablesChanged) Storage.set('tables', tables);
    } else {
        tables = [];
    }
    const grid = document.getElementById('tablesGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // Fetch sales and hold orders to match orders with tables
    const sales = Storage.get('sales') || [];
    const holdOrders = Storage.get('holdOrders') || [];

    // Get selected time filter type and selected value
    const timeFilterType = document.getElementById('tableTimeFilterType')?.value || 'alltime';
    let timeFilterValue = '';
    if (timeFilterType === 'daily') {
        timeFilterValue = document.getElementById('tableTimeDateInput')?.value || '';
    } else if (timeFilterType === 'weekly') {
        timeFilterValue = document.getElementById('tableTimeWeekInput')?.value || '';
    } else if (timeFilterType === 'monthly') {
        timeFilterValue = document.getElementById('tableTimeMonthInput')?.value || '';
    } else if (timeFilterType === 'annual') {
        timeFilterValue = document.getElementById('tableTimeYearInput')?.value || '';
    }

    // Match orders for each table and compute aggregate statistics
    tables.forEach(table => {
        const tableNumStr = String(table.number);

        // Find matching sales (completed)
        const matchingSales = sales.filter(sale => {
            const matchTable = String(sale.tableNo) === tableNumStr;
            const matchTime = isOrderInTableTimeFilter(sale.date, timeFilterType, timeFilterValue);
            return matchTable && matchTime;
        });

        // Find matching hold orders (pending)
        const matchingHolds = holdOrders.filter(hold => {
            const matchTable = String(hold.tableNo) === tableNumStr;
            const holdDate = hold.createdAt || hold.date;
            const matchTime = isOrderInTableTimeFilter(holdDate, timeFilterType, timeFilterValue);
            return matchTable && matchTime;
        });

        // Merge matching orders
        table.matchingOrders = [
            ...matchingHolds.map(h => ({
                id: h.id,
                orderId: h.orderId,
                orderNumber: h.orderNumber,
                date: h.createdAt || h.date,
                total: h.total || 0,
                status: 'pending',
                items: h.items || []
            })),
            ...matchingSales.map(s => ({
                id: s.id,
                orderId: s.orderId,
                orderNumber: s.orderNumber,
                date: s.date,
                total: s.total || 0,
                status: 'completed',
                items: s.items || []
            }))
        ];

        // Sort table's matching orders chronologically (newest first)
        table.matchingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Aggregate statistics (completed orders only)
        const completedOrders = table.matchingOrders.filter(o => o.status === 'completed');
        table.totalOrdersCount = completedOrders.length;
        table.totalRevenue = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    });

    // Filter tables by book status (All, Booked, Available)
    let filteredTables = tables;
    if (tablesFilter === 'booked') {
        filteredTables = tables.filter(table => table.status === 'booked');
    } else if (tablesFilter === 'available') {
        filteredTables = tables.filter(table => table.status === 'available' || !table.status);
    }

    // Sort the tables list
    const sortBy = document.getElementById('tableSortBy')?.value || 'number-asc';
    filteredTables.sort((a, b) => {
        if (sortBy === 'number-asc') {
            return parseInt(a.number, 10) - parseInt(b.number, 10);
        } else if (sortBy === 'number-desc') {
            return parseInt(b.number, 10) - parseInt(a.number, 10);
        } else if (sortBy === 'seats-asc') {
            return (a.seats || 0) - (b.seats || 0);
        } else if (sortBy === 'seats-desc') {
            return (b.seats || 0) - (a.seats || 0);
        } else if (sortBy === 'orders-asc') {
            return a.totalOrdersCount - b.totalOrdersCount;
        } else if (sortBy === 'orders-desc') {
            return b.totalOrdersCount - a.totalOrdersCount;
        } else if (sortBy === 'revenue-asc') {
            return a.totalRevenue - b.totalRevenue;
        } else if (sortBy === 'revenue-desc') {
            return b.totalRevenue - a.totalRevenue;
        }
        return 0;
    });
    
    // Store globally for print report
    window.currentFilteredTables = filteredTables;

    if (filteredTables.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999; font-family: \'Inter\', sans-serif;">No tables found. Add a table to get started.</div>';
        return;
    }

    // Create the table list HTML structure
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = 'width: 100%; overflow-x: auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 15px rgba(0,0,0,0.05);';

    const tableElement = document.createElement('table');
    tableElement.style.cssText = 'width: 100%; border-collapse: collapse; text-align: left; font-family: \'Inter\', sans-serif;';
    tableElement.innerHTML = `
        <thead>
            <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 700; font-size: 14px;">
                <th style="padding: 6px 12px; width: 40px; text-align: center;"></th>
                <th style="padding: 6px 12px;">Table Number</th>
                <th style="padding: 6px 12px;">Seats</th>
                <th style="padding: 6px 12px;">Status</th>
                <th style="padding: 6px 12px;">Booking Info</th>
                <th style="padding: 6px 12px; text-align: center;">Orders Count</th>
                <th style="padding: 6px 12px; text-align: right;">Total Revenue</th>
                <th style="padding: 6px 12px; text-align: center;">Actions</th>
            </tr>
        </thead>
        <tbody id="tableListBody"></tbody>
    `;

    tableContainer.appendChild(tableElement);
    grid.appendChild(tableContainer);

    const tableListBody = tableElement.querySelector('#tableListBody');

    filteredTables.forEach(table => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #4b5563; transition: background 0.15s; cursor: pointer;';
        tr.onmouseenter = () => { tr.style.backgroundColor = '#f9fafb'; };
        tr.onmouseleave = () => { tr.style.backgroundColor = 'transparent'; };

        const status = table.status || 'available';
        const statusColor = status === 'booked' ? '#10b981' : '#3b82f6';
        const statusBg = status === 'booked' ? '#ecfdf5' : '#eff6ff';
        const statusBadge = `<span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px; display: inline-block;">${status === 'booked' ? 'Booked' : 'Available'}</span>`;

        let bookingInfo = '<span style="color: #9ca3af;">-</span>';
        if (status === 'booked' && table.customerName) {
            const dateInfo = table.bookingDate ? formatDate(new Date(table.bookingDate + 'T00:00:00')) : '';
            const timeInfo = table.bookingTime ? formatTime12Hour(table.bookingTime) : '';
            bookingInfo = `
                <div style="font-weight: 600; color: #1f2937;">${escapeHtml(table.customerName)}</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">📞 ${escapeHtml(table.customerContact || 'N/A')}</div>
                ${dateInfo || timeInfo ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">📅 ${dateInfo} ${timeInfo ? '• ' + timeInfo : ''}</div>` : ''}
            `;
        }

        const totalOrders = table.totalOrdersCount;
        const totalRevenue = table.totalRevenue;

        tr.innerHTML = `
            <td style="padding: 6px 12px; text-align: center; font-size: 12px; color: #9ca3af; user-select: none;" class="expand-toggle">
                ${totalOrders > 0 ? '&#9654;' : ''}
            </td>
            <td style="padding: 6px 12px; font-weight: 700; color: #1f2937;">Table ${table.number}</td>
            <td style="padding: 6px 12px; font-weight: 500;">${table.seats} seats</td>
            <td style="padding: 6px 12px;">${statusBadge}</td>
            <td style="padding: 6px 12px;">${bookingInfo}</td>
            <td style="padding: 6px 12px; text-align: center; font-weight: 600; color: #1f2937;">${totalOrders}</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: 600; color: #10b981;">Rs. ${formatNumber(totalRevenue)}</td>
            <td style="padding: 6px 12px; text-align: center;">
                <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                    ${status === 'booked' ? 
                        `<button class="unbook-btn-list" data-table-id="${table.id}" style="background: #10b981; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; outline: none; transition: background 0.2s;">Unbook</button>` :
                        `<button onclick="event.stopPropagation(); openBookTableModal('${table.id}')" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; outline: none; transition: background 0.2s;">Book Now</button>`
                    }
                    ${status === 'booked' ?
                        `<button onclick="event.stopPropagation(); editTableBooking('${table.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit Booking">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                        </button>` : ''
                    }
                    <button onclick="event.stopPropagation(); editTable('${table.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit Table">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                    </button>
                    <button onclick="event.stopPropagation(); deleteTable('${table.id}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete Table">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;

        tr.onclick = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            if (totalOrders > 0) {
                toggleOrdersRow(table.id, tr);
            }
        };

        tableListBody.appendChild(tr);

        // Bind Unbook click handler safely
        if (status === 'booked') {
            const unbookBtn = tr.querySelector('.unbook-btn-list');
            if (unbookBtn) {
                unbookBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to unbook Table ${table.number}?`)) {
                        unbookTableConfirmed(table.id);
                    }
                });
            }
        }

        // Render details row if there are orders
        if (totalOrders > 0) {
            const detailTr = document.createElement('tr');
            detailTr.id = `orders-row-${table.id}`;
            detailTr.style.cssText = 'display: none; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;';

            let ordersRowsHTML = '';
            table.matchingOrders.forEach(order => {
                const dateObj = new Date(order.date);
                const orderTimeStr = isNaN(dateObj.getTime()) ? '-' : `${formatDate(dateObj)} ${formatTime(dateObj)}`;
                const itemsStr = order.items.map(item => `${item.name} x${item.quantity}`).join(', ');
                const statusBadgeOrder = order.status === 'completed'
                    ? '<span style="background: #ecfdf5; color: #10b981; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Completed</span>'
                    : '<span style="background: #fffbeb; color: #f59e0b; padding: 2px 8px; border-radius: 9999px; font-weight: 600; font-size: 11px;">Pending</span>';

                ordersRowsHTML += `
                    <tr style="border-bottom: 1px solid #f3f4f6; font-size: 13px;">
                        <td style="padding: 10px; font-weight: 600; color: #1f2937;">${escapeHtml(order.orderId || order.id)}</td>
                        <td style="padding: 10px;">${orderTimeStr}</td>
                        <td style="padding: 10px; max-width: 320px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${escapeHtml(itemsStr)}">${escapeHtml(itemsStr)}</td>
                        <td style="padding: 10px; text-align: right; font-weight: 600; color: #1f2937;">Rs. ${formatNumber(order.total)}</td>
                        <td style="padding: 10px; text-align: center;">${statusBadgeOrder}</td>
                        <td style="padding: 10px; text-align: center;">
                            ${order.status === 'completed'
                                ? `<button onclick="event.stopPropagation(); window.printReceiptForSale('${order.id}')" style="background: transparent; border: 1px solid #d1d5db; color: #4b5563; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500;">Print</button>`
                                : `<button onclick="event.stopPropagation(); editHoldOrder('${order.id}')" style="background: #3b82f6; color: white; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500;">Edit Order</button>`
                            }
                        </td>
                    </tr>
                `;
            });

            detailTr.innerHTML = `
                <td colspan="8" style="padding: 15px 30px;">
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 10px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                        <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #374151; font-family: 'Inter', sans-serif;">Order History (${totalOrders} orders)</h4>
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; color: #4b5563; font-weight: 600; font-size: 12px;">
                                    <th style="padding: 10px;">Order ID</th>
                                    <th style="padding: 10px;">Date & Time</th>
                                    <th style="padding: 10px;">Items</th>
                                    <th style="padding: 10px; text-align: right;">Total</th>
                                    <th style="padding: 10px; text-align: center;">Status</th>
                                    <th style="padding: 10px; text-align: center;">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ordersRowsHTML}
                            </tbody>
                        </table>
                    </div>
                </td>
            `;
            tableListBody.appendChild(detailTr);
        }
    });
}

window.filterTables = (filter) => {
    tablesFilter = filter;
    const allBtn = document.getElementById('tablesFilterAll');
    const bookedBtn = document.getElementById('tablesFilterBooked');
    const availableBtn = document.getElementById('tablesFilterAvailable');

    // Reset all buttons to inactive state
    if (allBtn) {
        allBtn.style.background = 'transparent';
        allBtn.style.color = '#666';
        allBtn.style.border = '1px solid transparent';
        allBtn.style.padding = '10px 18px';
        allBtn.style.fontSize = '16px';
        allBtn.style.boxShadow = 'none';
        allBtn.style.fontWeight = '500';
    }
    if (bookedBtn) {
        bookedBtn.style.background = 'transparent';
        bookedBtn.style.color = '#666';
        bookedBtn.style.border = '1px solid transparent';
        bookedBtn.style.padding = '10px 18px';
        bookedBtn.style.fontSize = '16px';
        bookedBtn.style.boxShadow = 'none';
        bookedBtn.style.fontWeight = '500';
    }
    if (availableBtn) {
        availableBtn.style.background = 'transparent';
        availableBtn.style.color = '#666';
        availableBtn.style.border = '1px solid transparent';
        availableBtn.style.padding = '10px 18px';
        availableBtn.style.fontSize = '16px';
        availableBtn.style.boxShadow = 'none';
        availableBtn.style.fontWeight = '500';
    }

    // Set active button with modern styling
    if (filter === 'all' && allBtn) {
        allBtn.style.background = '#4a90e2';
        allBtn.style.color = '#ffffff';
        allBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        allBtn.style.padding = '10px 18px';
        allBtn.style.fontSize = '16px';
        allBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        allBtn.style.fontWeight = '600';
    } else if (filter === 'booked' && bookedBtn) {
        bookedBtn.style.background = '#4a90e2';
        bookedBtn.style.color = '#ffffff';
        bookedBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        bookedBtn.style.padding = '10px 18px';
        bookedBtn.style.fontSize = '16px';
        bookedBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        bookedBtn.style.fontWeight = '600';
    } else if (filter === 'available' && availableBtn) {
        availableBtn.style.background = '#4a90e2';
        availableBtn.style.color = '#ffffff';
        availableBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        availableBtn.style.padding = '10px 18px';
        availableBtn.style.fontSize = '16px';
        availableBtn.style.boxShadow = '0 2px 4px rgba(74, 144, 226, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        availableBtn.style.fontWeight = '600';
    }

    loadTables();
};

window.printTablesReport = () => {
    const tables = window.currentFilteredTables || [];
    const activeTables = tables.filter(t => t.totalOrdersCount > 0);

    if (activeTables.length === 0) {
        alert('No tables with orders found to print for the selected time filter.');
        return;
    }

    const timeFilterType = document.getElementById('tableTimeFilterType')?.value || 'alltime';
    let filterLabel = 'All-Time';
    if (timeFilterType === 'daily') filterLabel = 'Daily';
    else if (timeFilterType === 'weekly') filterLabel = 'Weekly';
    else if (timeFilterType === 'monthly') filterLabel = 'Monthly';
    else if (timeFilterType === 'annual') filterLabel = 'Annual';

    // Generate HTML for the print window
    let html = `
        <html>
            <head>
                <title>Tables Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        padding: 10px 0;
                        margin: 0;
                        width: 80mm;
                        color: #000;
                        background: #fff;
                    }
                    h2 { text-align: center; margin-bottom: 2px; font-size: 16px; font-weight: bold; }
                    .filter-info { text-align: center; margin-bottom: 10px; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border-bottom: 1px dashed #eee; padding: 4px 2px; text-align: center; }
                    th { font-weight: bold; border-bottom: 1px solid #000; border-top: 1px dashed #000; }
                    .text-left { text-align: left; }
                    .text-right { text-align: right; }
                    .totals { font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; }
                    .totals td { padding: 6px 2px; border: none; }
                </style>
            </head>
            <body>
                <h2>TABLES REPORT</h2>
                <div class="filter-info">Filter: ${filterLabel}</div>
                <table>
                    <thead>
                        <tr>
                            <th class="text-left">Table</th>
                            <th>Ord</th>
                            <th class="text-right">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    let totalAllOrders = 0;
    let totalAllRevenue = 0;

    activeTables.forEach(t => {
        totalAllOrders += t.totalOrdersCount;
        totalAllRevenue += t.totalRevenue;
        html += `
            <tr>
                <td class="text-left">T-${t.number}</td>
                <td>${t.totalOrdersCount}</td>
                <td class="text-right">${formatNumber(t.totalRevenue)}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                    <tfoot>
                        <tr class="totals">
                            <td class="text-left">Total:</td>
                            <td>${totalAllOrders}</td>
                            <td class="text-right">${formatNumber(totalAllRevenue)}</td>
                        </tr>
                    </tfoot>
                </table>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
};

window.openAddTableModal = () => {
    editingTableId = null;
    const modalTitle = document.getElementById('tableModalTitle');
    const tableForm = document.getElementById('tableForm');
    const modal = document.getElementById('addTableModal');

    if (!modalTitle || !tableForm || !modal) {
        console.error('Table modal elements not found');
        return;
    }

    modalTitle.textContent = 'Add Table';
    tableForm.reset();
    modal.style.display = 'flex';
};

window.closeAddTableModal = () => {
    document.getElementById('addTableModal').style.display = 'none';
    document.getElementById('tableForm').reset();
    editingTableId = null;
};

window.openBookTableModal = (tableId) => {
    currentBookingTableId = String(tableId);
    const form = document.getElementById('bookTableForm');
    form.reset();

    // Check if table is already booked and populate form with existing details
    const tables = Storage.get('tables') || [];
    const table = tables.find(t => String(t.id) === String(tableId));
    if (table && table.status === 'booked' && table.customerName) {
        const customerNameInput = document.getElementById('customerName');
        const customerContactInput = document.getElementById('customerContact');
        const bookingDateInput = document.getElementById('bookingDate');
        const bookingTimeInput = document.getElementById('bookingTime');
        if (customerNameInput) {
            customerNameInput.value = table.customerName || '';
        }
        if (customerContactInput) {
            customerContactInput.value = table.customerContact || '';
        }
        if (bookingDateInput) {
            bookingDateInput.value = table.bookingDate || '';
        }
        if (bookingTimeInput) {
            bookingTimeInput.value = table.bookingTime || '';
        }
    } else {
        // Set default date and time to current date/time for new bookings
        const bookingDateInput = document.getElementById('bookingDate');
        const bookingTimeInput = document.getElementById('bookingTime');
        if (bookingDateInput) {
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            bookingDateInput.value = dateStr;
        }
        if (bookingTimeInput) {
            const now = new Date();
            const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            bookingTimeInput.value = timeStr;
        }
    }

    document.getElementById('bookTableModal').style.display = 'flex';
};

window.editTableBooking = (tableId) => {
    openActionPasswordModal(() => {
        openBookTableModal(tableId);
    });
};

window.closeBookTableModal = () => {
    document.getElementById('bookTableModal').style.display = 'none';
    document.getElementById('bookTableForm').reset();
    currentBookingTableId = null;
};

window.editTable = (id) => {
    openActionPasswordModal(() => {
        const tables = Storage.get('tables') || [];
        const table = tables.find(t => String(t.id) === String(id));
        if (!table) {
            alert('Table not found!');
            return;
        }

        editingTableId = String(id);
        document.getElementById('tableModalTitle').textContent = 'Edit Table';
        document.getElementById('tableNumber').value = table.number;
        document.getElementById('tableSeats').value = table.seats;
        document.getElementById('addTableModal').style.display = 'flex';
    });
};

window.deleteTable = (id, buttonElement) => {
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement || !btnElement.parentElement || !document.contains(buttonElement)) {
            // Try to find the button in the DOM by looking for the table card
            const tableCards = document.querySelectorAll('.table-card, [data-table-id]');
            for (let card of tableCards) {
                if (card.getAttribute('data-table-id') === String(id)) {
                    const deleteBtn = card.querySelector('button[onclick*="deleteTable"]');
                    if (deleteBtn) {
                        btnElement = deleteBtn;
                        break;
                    }
                }
            }
        }

        if (btnElement) {
            showDeleteConfirmation(btnElement, deleteTableConfirmed, id);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteTableConfirmed(id);
        }
    });
};

function deleteTableConfirmed(id) {
    const tables = Storage.get('tables') || [];
    const filtered = tables.filter(t => String(t.id) !== String(id));
    Storage.set('tables', filtered);
    loadTables();
}

window.searchExpenses = () => {
    loadExpenses();
};

// Dashboard Management
function loadDashboard() {
    // Get all data
    const sales = Storage.get('sales') || [];
    const expenses = Storage.get('expenses') || [];
    const employees = Storage.get('employees') || [];
    const menuItems = Storage.get('menuItems') || [];
    const holdOrders = Storage.get('holdOrders') || [];
    const tables = Storage.get('tables') || [];

    // Calculate today's date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Calculate week date range
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Calculate month date range
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Today's Sales
    const todaySales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        // Use sale.total if available (includes tax), otherwise calculate with tax
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            // For old sales without items array, use amount and add tax if needed
            const amount = sale.amount || sale.total || 0;
            // If it's an old sale, assume it might not have tax, so add it
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // Today's Expenses
    const todayExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate.getTime() === today.getTime();
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Today's Profit
    const todayProfit = todaySales - todayExpenses;

    // This Week Sales
    const weekSales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        // Use sale.total if available (includes tax), otherwise calculate with tax
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            // For old sales without items array, use amount and add tax if needed
            const amount = sale.amount || sale.total || 0;
            // If it's an old sale, assume it might not have tax, so add it
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // This Week Expenses
    const weekExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= weekAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // This Month Sales
    const monthSales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= monthAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        // Use sale.total if available (includes tax), otherwise calculate with tax
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            // For old sales without items array, use amount and add tax if needed
            const amount = sale.amount || sale.total || 0;
            // If it's an old sale, assume it might not have tax, so add it
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // This Month Expenses
    const monthExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= monthAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Tables Status - count only available (unbooked) tables
    const availableTables = tables.filter(t => t.status !== 'booked').length;

    // Today's Discounts (total)
    const todayDiscounts = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        const subtotalFallback = (typeof sale.subtotal === 'number')
            ? sale.subtotal
            : (sale.items && Array.isArray(sale.items) ? sale.items.reduce((s, it) => s + (it.price * it.quantity), 0) : (sale.total || 0));
        return sum + getDiscountAmountFromOrder(sale, subtotalFallback);
    }, 0);

    // Weekly Discounts (total)
    const weeklyDiscounts = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        const subtotalFallback = (typeof sale.subtotal === 'number')
            ? sale.subtotal
            : (sale.items && Array.isArray(sale.items) ? sale.items.reduce((s, it) => s + (it.price * it.quantity), 0) : (sale.total || 0));
        return sum + getDiscountAmountFromOrder(sale, subtotalFallback);
    }, 0);

    // Calculate Today's Tax
    const todayTax = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        // Exclude tax for Parcel/Delivery orders
        const paymentMethod = sale.paymentMethod || 'cash';
        if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
            return sum; // No tax for parcel orders
        }
        // Use sale.tax if available
        if (sale.tax) {
            return sum + sale.tax;
        } else if (sale.subtotal) {
            // Calculate tax from subtotal (5% of subtotal after discount)
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else if (sale.items && Array.isArray(sale.items)) {
            // Calculate from items
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else {
            // Fallback: estimate tax from total (assuming total includes tax)
            return sum + (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
        }
    }, 0);

    // Calculate Weekly Tax
    const weeklyTax = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        // Exclude tax for Parcel/Delivery orders
        const paymentMethod = sale.paymentMethod || 'cash';
        if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
            return sum; // No tax for parcel orders
        }
        // Use sale.tax if available
        if (sale.tax) {
            return sum + sale.tax;
        } else if (sale.subtotal) {
            // Calculate tax from subtotal (5% of subtotal after discount)
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else if (sale.items && Array.isArray(sale.items)) {
            // Calculate from items
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else {
            // Fallback: estimate tax from total (assuming total includes tax)
            return sum + (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
        }
    }, 0);

    // Update Dashboard Elements
    const todaySalesEl = document.getElementById('dashboardTodaySales');
    const todayExpensesEl = document.getElementById('dashboardTodayExpenses');
    const todayProfitEl = document.getElementById('dashboardTodayProfit');
    const holdOrdersEl = document.getElementById('dashboardHoldOrders');
    const todayDiscountsEl = document.getElementById('dashboardTodayDiscounts');
    const weeklyDiscountsEl = document.getElementById('dashboardWeeklyDiscounts');
    const todayTaxesEl = document.getElementById('dashboardTodayTaxes');
    const weeklyTaxesEl = document.getElementById('dashboardWeeklyTaxes');
    const weekSalesEl = document.getElementById('dashboardWeekSales');
    const weekExpensesEl = document.getElementById('dashboardWeekExpenses');
    const monthSalesEl = document.getElementById('dashboardMonthSales');
    const monthExpensesEl = document.getElementById('dashboardMonthExpenses');
    const recentSalesEl = document.getElementById('dashboardRecentSales');

    if (todaySalesEl) todaySalesEl.textContent = `Rs. ${formatNumber(todaySales)}`;
    if (todayExpensesEl) todayExpensesEl.textContent = `Rs. ${formatNumber(todayExpenses)}`;
    if (todayProfitEl) {
        todayProfitEl.textContent = `Rs. ${formatNumber(todayProfit)}`;
        todayProfitEl.style.color = todayProfit >= 0 ? '#27ae60' : '#e74c3c';
    }
    if (holdOrdersEl) holdOrdersEl.textContent = formatNumber(holdOrders.length);
    if (todayDiscountsEl) todayDiscountsEl.textContent = `Rs. ${formatNumber(todayDiscounts)}`;
    if (weeklyDiscountsEl) weeklyDiscountsEl.textContent = `Rs. ${formatNumber(weeklyDiscounts)}`;
    if (todayTaxesEl) todayTaxesEl.textContent = `Rs. ${formatNumber(todayTax)}`;
    if (weeklyTaxesEl) weeklyTaxesEl.textContent = `Rs. ${formatNumber(weeklyTax)}`;
    if (weekSalesEl) weekSalesEl.textContent = `Rs. ${formatNumber(weekSales)}`;
    if (weekExpensesEl) weekExpensesEl.textContent = `Rs. ${formatNumber(weekExpenses)}`;
    if (monthSalesEl) monthSalesEl.textContent = `Rs. ${formatNumber(monthSales)}`;
    if (monthExpensesEl) monthExpensesEl.textContent = `Rs. ${formatNumber(monthExpenses)}`;
}

window.printDashboard = () => {
    // Get all data (same logic as loadDashboard)
    const sales = Storage.get('sales') || [];
    const expenses = Storage.get('expenses') || [];
    const employees = Storage.get('employees') || [];
    const menuItems = Storage.get('menuItems') || [];
    const holdOrders = Storage.get('holdOrders') || [];
    const tables = Storage.get('tables') || [];

    // Calculate today's date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Calculate week date range
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Calculate month date range
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Today's Sales
    const todaySales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            const amount = sale.amount || sale.total || 0;
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // Today's Expenses
    const todayExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate.getTime() === today.getTime();
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Today's Profit
    const todayProfit = todaySales - todayExpenses;

    // This Week Sales
    const weekSales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            const amount = sale.amount || sale.total || 0;
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // This Week Expenses
    const weekExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= weekAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // This Month Sales
    const monthSales = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= monthAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            const amount = sale.amount || sale.total || 0;
            const subtotal = amount;
            return sum + subtotal;
        }
    }, 0);

    // This Month Expenses
    const monthExpenses = expenses.filter(exp => {
        if (!exp.date) return false;
        const expDate = new Date(exp.date);
        expDate.setHours(0, 0, 0, 0);
        return expDate >= monthAgo && expDate <= todayEnd;
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Tables Status
    const availableTables = tables.filter(t => t.status !== 'booked').length;
    const totalTables = tables.length;

    // Today's Discounts
    const todayDiscounts = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        const subtotalFallback = (typeof sale.subtotal === 'number')
            ? sale.subtotal
            : (sale.items && Array.isArray(sale.items) ? sale.items.reduce((s, it) => s + (it.price * it.quantity), 0) : (sale.total || 0));
        return sum + getDiscountAmountFromOrder(sale, subtotalFallback);
    }, 0);

    // Weekly Discounts
    const weeklyDiscounts = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        const subtotalFallback = (typeof sale.subtotal === 'number')
            ? sale.subtotal
            : (sale.items && Array.isArray(sale.items) ? sale.items.reduce((s, it) => s + (it.price * it.quantity), 0) : (sale.total || 0));
        return sum + getDiscountAmountFromOrder(sale, subtotalFallback);
    }, 0);

    // Calculate Today's Tax
    const todayTax = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime();
    }).reduce((sum, sale) => {
        // Exclude tax for Parcel/Delivery orders
        const paymentMethod = sale.paymentMethod || 'cash';
        if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
            return sum; // No tax for parcel orders
        }
        // Use sale.tax if available
        if (sale.tax) {
            return sum + sale.tax;
        } else if (sale.subtotal) {
            // Calculate tax from subtotal (5% of subtotal after discount)
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else if (sale.items && Array.isArray(sale.items)) {
            // Calculate from items
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else {
            // Fallback: estimate tax from total (assuming total includes tax)
            return sum + (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
        }
    }, 0);

    // Calculate Weekly Tax
    const weeklyTax = sales.filter(sale => {
        if (!sale.date) return false;
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate >= weekAgo && saleDate <= todayEnd;
    }).reduce((sum, sale) => {
        // Exclude tax for Parcel/Delivery orders
        const paymentMethod = sale.paymentMethod || 'cash';
        if (paymentMethod === 'delivery' || paymentMethod === 'parcel') {
            return sum; // No tax for parcel orders
        }
        // Use sale.tax if available
        if (sale.tax) {
            return sum + sale.tax;
        } else if (sale.subtotal) {
            // Calculate tax from subtotal (5% of subtotal after discount)
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, sale.subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else if (sale.items && Array.isArray(sale.items)) {
            // Calculate from items
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            const discountAmount = sale.discount && sale.discount.amount ? sale.discount.amount : 0;
            const discountedSubtotal = Math.max(0, subtotal - discountAmount);
            return sum + (discountedSubtotal * SALES_TAX_RATE);
        } else {
            // Fallback: estimate tax from total (assuming total includes tax)
            return sum + (sale.total || 0) * (SALES_TAX_RATE / (1 + SALES_TAX_RATE));
        }
    }, 0);

    // Total Sales (all time)
    const totalSales = sales.reduce((sum, sale) => {
        if (sale.total) {
            return sum + sale.total;
        } else if (sale.items && Array.isArray(sale.items)) {
            const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
            return sum + subtotal;
        } else {
            const amount = sale.amount || sale.total || 0;
            return sum + amount;
        }
    }, 0);

    // Total Expenses (all time)
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Total Profit (all time)
    const totalProfit = totalSales - totalExpenses;

    const printWindow = window.open('', '_blank');
    const nowDate = new Date();
    const dateStr = nowDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const currentDate = dateStr + ' ' + timeStr;

    const weekProfit = weekSales - weekExpenses;
    const monthProfit = monthSales - monthExpenses;

    printWindow.document.write(`
        <html>
            <head>
                <title>Dashboard Report</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 11px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                        max-width: 80mm;
                        margin: 0 auto;
                    }
                    .receipt-logo {
                        max-width: 100px;
                        max-height: 100px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 8px auto;
                        display: block;
                        object-fit: contain;
                    }
                    .header-section {
                        text-align: center;
                        margin-bottom: 10px;
                        font-weight: 600;
                    }
                    .restaurant-name {
                        font-size: 16px;
                        font-weight: 900;
                        margin-bottom: 4px;
                    }
                    .report-title {
                        font-size: 14px;
                        font-weight: 700;
                        margin: 8px 0;
                    }
                    .report-info {
                        font-size: 10px;
                        margin: 4px 0;
                        font-weight: 600;
                    }
                    .separator {
                        border-top: 1px dashed #000;
                        margin: 6px 0;
                    }
                    .section-title {
                        font-size: 11px;
                        font-weight: 700;
                        margin: 8px 0 4px 0;
                        text-align: center;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                        font-size: 9px;
                    }
                    td {
                        padding: 2px 2px;
                        border-bottom: 1px dotted #ccc;
                        font-size: 9px;
                        font-weight: 600;
                        line-height: 1.2;
                    }
                    td:first-child {
                        text-align: left;
                    }
                    td:last-child {
                        text-align: right;
                    }
                    .summary-section {
                        text-align: center;
                        margin-top: 8px;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                            max-width: 80mm;
                        }
                        .receipt-logo {
                            max-width: 80px;
                            max-height: 80px;
                            margin: 0 auto 6px auto;
                        }
                        table {
                            font-size: 9px;
                            border-spacing: 0;
                        }
                        td {
                            font-size: 9px;
                            padding: 1px 1px;
                            font-weight: 600 !important;
                            line-height: 1.2 !important;
                        }
                        .header-section, .report-info, .summary-section, .section-title {
                            font-weight: 600 !important;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div class="header-section">
                    <div class="restaurant-name">ABC Restaurant</div>
                    <div class="report-info">Contact: 0319-9922922</div>
                    <div class="report-info">Wah Model Town, Wah Cantt</div>
                    <div class="separator"></div>
                    <div class="report-title">DASHBOARD REPORT</div>
                    <div class="separator"></div>
                    <div class="report-info">Date: ${currentDate}</div>
                    <div class="separator"></div>
                </div>
                
                <div class="section-title">TODAY'S PERFORMANCE</div>
                <table>
                    <tr><td>Today's Sales</td><td>Rs.${formatNumber(todaySales)}</td></tr>
                    <tr><td>Today's Expenses</td><td>Rs.${formatNumber(todayExpenses)}</td></tr>
                    <tr><td>Today's Profit</td><td style="color: ${todayProfit >= 0 ? '#27ae60' : '#e74c3c'};">Rs.${formatNumber(todayProfit)}</td></tr>
                    <tr><td>Hold Orders</td><td>${formatNumber(holdOrders.length)}</td></tr>
                    <tr><td>Today's Discounts</td><td>Rs.${formatNumber(todayDiscounts)}</td></tr>
                    <tr><td>Weekly Discounts</td><td>Rs.${formatNumber(weeklyDiscounts)}</td></tr>
                    <tr><td>Today's Taxes</td><td>Rs.${formatNumber(todayTax)}</td></tr>
                    <tr><td>Weekly Taxes</td><td>Rs.${formatNumber(weeklyTax)}</td></tr>
                </table>
                
                <div class="separator"></div>
                <div class="section-title">THIS WEEK</div>
                <table>
                    <tr><td>Sales</td><td>Rs.${formatNumber(weekSales)}</td></tr>
                    <tr><td>Expenses</td><td>Rs.${formatNumber(weekExpenses)}</td></tr>
                    <tr><td>Profit</td><td style="color: ${weekProfit >= 0 ? '#27ae60' : '#e74c3c'};">Rs.${formatNumber(weekProfit)}</td></tr>
                </table>
                
                <div class="separator"></div>
                <div class="section-title">THIS MONTH</div>
                <table>
                    <tr><td>Sales</td><td>Rs.${formatNumber(monthSales)}</td></tr>
                    <tr><td>Expenses</td><td>Rs.${formatNumber(monthExpenses)}</td></tr>
                    <tr><td>Profit</td><td style="color: ${monthProfit >= 0 ? '#27ae60' : '#e74c3c'};">Rs.${formatNumber(monthProfit)}</td></tr>
                </table>
                
                <div class="separator"></div>
                <div class="section-title">ALL TIME</div>
                <table>
                    <tr><td>Total Sales</td><td>Rs.${formatNumber(totalSales)}</td></tr>
                    <tr><td>Total Expenses</td><td>Rs.${formatNumber(totalExpenses)}</td></tr>
                    <tr><td>Total Profit</td><td style="color: ${totalProfit >= 0 ? '#27ae60' : '#e74c3c'};">Rs.${formatNumber(totalProfit)}</td></tr>
                </table>
                
                <div class="summary-section">
                    <div class="separator"></div>
                    <div style="font-weight: 700; margin: 4px 0;">Total Orders: ${formatNumber(sales.length)}</div>
                    <div style="margin: 4px 0;">Thank You!</div>
                    <div style="margin-top: 10px;"></div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 100);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();

    // Load Recent Sales
    if (recentSalesEl) {
        const recentSales = sales
            .sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp))
            .slice(0, 5);

        if (recentSales.length === 0) {
            recentSalesEl.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No recent sales</p>';
        } else {
            recentSalesEl.innerHTML = recentSales.map(sale => {
                const saleDate = sale.date ? new Date(sale.date) : (sale.timestamp ? new Date(sale.timestamp) : new Date());
                const dateStr = formatDate(saleDate);
                const timeStr = formatTime(saleDate);
                // Use sale.total if available (includes tax), otherwise calculate with tax
                let total;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    const subtotal = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                    total = subtotal;
                } else {
                    const amount = sale.amount || 0;
                    const subtotal = amount;
                    total = subtotal;
                }
                const paymentMethod = formatPaymentMethod(sale.paymentMethod || sale.payment || 'N/A');

                return `
                    <div style="padding: 15px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600; color: #333; margin-bottom: 5px;">${dateStr} ${timeStr}</div>
                            <div style="font-size: 12px; color: #666;">Payment: ${paymentMethod}</div>
                        </div>
                        <div style="font-weight: 700; color: #1e3a5f; font-size: 18px;">Rs. ${formatNumber(total)}</div>
                    </div>
                `;
            }).join('');
        }
    }

    // Update charts
    updateCharts();

    // Initialize sales chart view buttons
    if (typeof changeSalesChartView === 'function') {
        changeSalesChartView(currentSalesChartView);
    }

    // Initialize profit chart view buttons
    if (typeof changeProfitChartView === 'function') {
        changeProfitChartView(currentProfitChartView);
    }

    // Initialize customer chart view buttons
    if (typeof changeCustomerChartView === 'function') {
        changeCustomerChartView(currentCustomerChartView);
    }

    // Update customer count comparison
    updateCustomerCountComparison();
}

// Chart Management
let salesChart = null;
let profitChart = null;
let customerChart = null;
let currentSalesChartView = 'daily';
let currentProfitChartView = 'daily';
let currentCustomerChartView = 'daily';

// Initialize charts
function initCharts() {
    const salesCtx = document.getElementById('salesChart');
    const profitCtx = document.getElementById('profitChart');
    const customerCtx = document.getElementById('customerChart');

    if (!salesCtx || !profitCtx || !customerCtx) return;

    // Destroy existing charts if they exist
    if (salesChart) salesChart.destroy();
    if (profitChart) profitChart.destroy();
    if (customerChart) customerChart.destroy();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        return 'Rs. ' + formatNumber(context.parsed.y);
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value) {
                        return 'Rs. ' + formatNumber(value);
                    }
                },
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        elements: {
            bar: {
                borderRadius: 0
            }
        }
    };

    salesChart = new Chart(salesCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Sales',
                data: [],
                backgroundColor: '#4a90e2',
                borderColor: '#4a90e2',
                borderWidth: 0
            }]
        },
        options: chartOptions
    });

    profitChart = new Chart(profitCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Profit',
                data: [],
                backgroundColor: '#27ae60',
                borderColor: '#27ae60',
                borderWidth: 0
            }]
        },
        options: chartOptions
    });

    // Customer count chart (bar)
    customerChart = new Chart(customerCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Customers',
                data: [],
                backgroundColor: '#ff9800',
                borderColor: '#ff9800',
                borderWidth: 0,
                borderRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y + ' customers';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        callback: function (value) {
                            return value;
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                bar: {
                    borderRadius: 0
                }
            }
        }
    });
}

// Update charts based on current view
function updateCharts() {
    if (!salesChart || !profitChart || !customerChart) {
        initCharts();
    }

    // Update charts separately
    updateSalesChart();
    updateProfitChart();
    updateCustomerChart();
}

// Update sales chart based on current sales chart view
function updateSalesChart() {
    if (!salesChart) {
        if (!salesChart || !profitChart || !customerChart) {
            initCharts();
        }
    }

    const sales = Storage.get('sales') || [];
    let labels = [];
    let salesData = [];

    if (currentSalesChartView === 'daily') {
        labels = Array.from({ length: 24 }, (_, i) => {
            if (i === 0) return '12am';
            if (i === 12) return '12pm';
            if (i < 12) return `${i}am`;
            return `${i - 12}pm`;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        salesData = new Array(24).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= today && saleDate <= todayEnd) {
                const hour = saleDate.getHours();
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[hour] += total;
            }
        });

    } else if (currentSalesChartView === 'weekly') {
        const now = new Date();
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

        const monday = new Date(now);
        monday.setDate(now.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            date.setHours(0, 0, 0, 0);
            days.push(date);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            labels.push(dayNames[date.getDay()] + ' ' + date.getDate());
        }

        salesData = new Array(7).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            saleDate.setHours(0, 0, 0, 0);
            const dayIndex = days.findIndex(d => d.getTime() === saleDate.getTime());
            if (dayIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[dayIndex] += total;
            }
        });

    } else if (currentSalesChartView === 'monthly') {
        const now = new Date();
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            weeks.push({ start: weekStart, end: weekEnd });
            labels.push(`Week ${4 - i}`);
        }

        salesData = new Array(4).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const weekIndex = weeks.findIndex(w => saleDate >= w.start && saleDate <= w.end);
            if (weekIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[weekIndex] += total;
            }
        });

    } else if (currentSalesChartView === 'annual') {
        const now = new Date();
        const months = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
            months.push({ start, end });
            labels.push(`${monthNames[start.getMonth()]} '${String(start.getFullYear()).slice(-2)}`);
        }

        salesData = new Array(12).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const monthIndex = months.findIndex(m => saleDate >= m.start && saleDate <= m.end);
            if (monthIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[monthIndex] += total;
            }
        });

    } else if (currentSalesChartView === 'yearly') {
        // Yearly view: Group by years
        const now = new Date();
        const currentYear = now.getFullYear();

        // Get all unique years from sales data
        const yearsSet = new Set();
        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            yearsSet.add(saleDate.getFullYear());
        });

        // Create array of years (at least last 5 years, or all years if more)
        const years = Array.from(yearsSet).sort((a, b) => a - b);
        const minYear = Math.min(...years, currentYear - 4);
        const maxYear = Math.max(...years, currentYear);

        for (let year = minYear; year <= maxYear; year++) {
            labels.push(String(year));
        }

        salesData = new Array(labels.length).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const year = saleDate.getFullYear();
            const yearIndex = labels.indexOf(String(year));
            if (yearIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[yearIndex] += total;
            }
        });
    }

    salesChart.data.labels = labels;
    salesChart.data.datasets[0].data = salesData;
    salesChart.update();
}

// Update profit chart based on current profit chart view
function updateProfitChart() {
    if (!profitChart) {
        if (!salesChart || !profitChart || !customerChart) {
            initCharts();
        }
    }

    const sales = Storage.get('sales') || [];
    const expenses = Storage.get('expenses') || [];
    let labels = [];
    let salesData = [];
    let profitData = [];

    if (currentProfitChartView === 'daily') {
        labels = Array.from({ length: 24 }, (_, i) => {
            if (i === 0) return '12am';
            if (i === 12) return '12pm';
            if (i < 12) return `${i}am`;
            return `${i - 12}pm`;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        salesData = new Array(24).fill(0);
        const expensesByHour = new Array(24).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= today && saleDate <= todayEnd) {
                const hour = saleDate.getHours();
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[hour] += total;
            }
        });

        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            if (expDate >= today && expDate <= todayEnd) {
                const hour = expDate.getHours();
                expensesByHour[hour] += (exp.amount || 0);
            }
        });

        profitData = salesData.map((sales, hour) => sales - expensesByHour[hour]);

    } else if (currentProfitChartView === 'weekly') {
        const now = new Date();
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

        const monday = new Date(now);
        monday.setDate(now.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            date.setHours(0, 0, 0, 0);
            days.push(date);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            labels.push(dayNames[date.getDay()] + ' ' + date.getDate());
        }

        salesData = new Array(7).fill(0);
        const expensesByDay = new Array(7).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            saleDate.setHours(0, 0, 0, 0);
            const dayIndex = days.findIndex(d => d.getTime() === saleDate.getTime());
            if (dayIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[dayIndex] += total;
            }
        });

        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            expDate.setHours(0, 0, 0, 0);
            const dayIndex = days.findIndex(d => d.getTime() === expDate.getTime());
            if (dayIndex !== -1) {
                expensesByDay[dayIndex] += (exp.amount || 0);
            }
        });

        profitData = salesData.map((sales, day) => sales - expensesByDay[day]);

    } else if (currentProfitChartView === 'monthly') {
        const now = new Date();
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            weeks.push({ start: weekStart, end: weekEnd });
            labels.push(`Week ${4 - i}`);
        }

        salesData = new Array(4).fill(0);
        const expensesByWeek = new Array(4).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const weekIndex = weeks.findIndex(w => saleDate >= w.start && saleDate <= w.end);
            if (weekIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[weekIndex] += total;
            }
        });

        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            const weekIndex = weeks.findIndex(w => expDate >= w.start && expDate <= w.end);
            if (weekIndex !== -1) {
                expensesByWeek[weekIndex] += (exp.amount || 0);
            }
        });

        profitData = salesData.map((sales, week) => sales - expensesByWeek[week]);

    } else if (currentProfitChartView === 'annual') {
        const now = new Date();
        const months = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
            months.push({ start, end });
            labels.push(`${monthNames[start.getMonth()]} '${String(start.getFullYear()).slice(-2)}`);
        }

        salesData = new Array(12).fill(0);
        const expensesByMonth = new Array(12).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const monthIndex = months.findIndex(m => saleDate >= m.start && saleDate <= m.end);
            if (monthIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[monthIndex] += total;
            }
        });

        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            const monthIndex = months.findIndex(m => expDate >= m.start && expDate <= m.end);
            if (monthIndex !== -1) {
                expensesByMonth[monthIndex] += (exp.amount || 0);
            }
        });

        profitData = salesData.map((sales, idx) => sales - expensesByMonth[idx]);

    } else if (currentProfitChartView === 'yearly') {
        // Yearly view: Group by years
        const now = new Date();
        const currentYear = now.getFullYear();

        // Get all unique years from sales and expenses data
        const yearsSet = new Set();
        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            yearsSet.add(saleDate.getFullYear());
        });
        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            yearsSet.add(expDate.getFullYear());
        });

        // Create array of years (at least last 5 years, or all years if more)
        const years = Array.from(yearsSet).sort((a, b) => a - b);
        const minYear = Math.min(...years, currentYear - 4);
        const maxYear = Math.max(...years, currentYear);

        for (let year = minYear; year <= maxYear; year++) {
            labels.push(String(year));
        }

        salesData = new Array(labels.length).fill(0);
        const expensesByYear = new Array(labels.length).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const year = saleDate.getFullYear();
            const yearIndex = labels.indexOf(String(year));
            if (yearIndex !== -1) {
                let total = 0;
                if (sale.total) {
                    total = sale.total;
                } else if (sale.items && Array.isArray(sale.items)) {
                    total = sale.items.reduce((s, item) => s + (item.price * item.quantity), 0);
                } else {
                    total = sale.amount || sale.total || 0;
                }
                salesData[yearIndex] += total;
            }
        });

        expenses.forEach(exp => {
            if (!exp.date) return;
            const expDate = new Date(exp.date);
            const year = expDate.getFullYear();
            const yearIndex = labels.indexOf(String(year));
            if (yearIndex !== -1) {
                expensesByYear[yearIndex] += (exp.amount || 0);
            }
        });

        profitData = salesData.map((sales, idx) => sales - expensesByYear[idx]);
    }

    profitChart.data.labels = labels;
    profitChart.data.datasets[0].data = profitData;
    profitChart.update();
}

// Change sales chart view
window.changeSalesChartView = (view) => {
    currentSalesChartView = view;

    const dailyBtn = document.getElementById('salesChartViewDaily');
    const weeklyBtn = document.getElementById('salesChartViewWeekly');
    const monthlyBtn = document.getElementById('salesChartViewMonthly');
    const annualBtn = document.getElementById('salesChartViewAnnual');
    const yearlyBtn = document.getElementById('salesChartViewYearly');

    if (dailyBtn) {
        if (view === 'daily') {
            dailyBtn.style.background = '#4a90e2';
            dailyBtn.style.color = '#ffffff';
            dailyBtn.style.fontWeight = '600';
        } else {
            dailyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            dailyBtn.style.color = '#4a90e2';
            dailyBtn.style.fontWeight = '500';
        }
    }

    if (weeklyBtn) {
        if (view === 'weekly') {
            weeklyBtn.style.background = '#4a90e2';
            weeklyBtn.style.color = '#ffffff';
            weeklyBtn.style.fontWeight = '600';
        } else {
            weeklyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            weeklyBtn.style.color = '#4a90e2';
            weeklyBtn.style.fontWeight = '500';
        }
    }

    if (monthlyBtn) {
        if (view === 'monthly') {
            monthlyBtn.style.background = '#4a90e2';
            monthlyBtn.style.color = '#ffffff';
            monthlyBtn.style.fontWeight = '600';
        } else {
            monthlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            monthlyBtn.style.color = '#4a90e2';
            monthlyBtn.style.fontWeight = '500';
        }
    }

    if (annualBtn) {
        if (view === 'annual') {
            annualBtn.style.background = '#4a90e2';
            annualBtn.style.color = '#ffffff';
            annualBtn.style.fontWeight = '600';
        } else {
            annualBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            annualBtn.style.color = '#4a90e2';
            annualBtn.style.fontWeight = '500';
        }
    }

    if (yearlyBtn) {
        if (view === 'yearly') {
            yearlyBtn.style.background = '#4a90e2';
            yearlyBtn.style.color = '#ffffff';
            yearlyBtn.style.fontWeight = '600';
        } else {
            yearlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            yearlyBtn.style.color = '#4a90e2';
            yearlyBtn.style.fontWeight = '500';
        }
    }

    updateSalesChart();
}

// Change profit chart view
window.changeProfitChartView = (view) => {
    currentProfitChartView = view;

    const dailyBtn = document.getElementById('profitChartViewDaily');
    const weeklyBtn = document.getElementById('profitChartViewWeekly');
    const monthlyBtn = document.getElementById('profitChartViewMonthly');
    const annualBtn = document.getElementById('profitChartViewAnnual');
    const yearlyBtn = document.getElementById('profitChartViewYearly');

    if (dailyBtn) {
        if (view === 'daily') {
            dailyBtn.style.background = '#4a90e2';
            dailyBtn.style.color = '#ffffff';
            dailyBtn.style.fontWeight = '600';
        } else {
            dailyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            dailyBtn.style.color = '#4a90e2';
            dailyBtn.style.fontWeight = '500';
        }
    }

    if (weeklyBtn) {
        if (view === 'weekly') {
            weeklyBtn.style.background = '#4a90e2';
            weeklyBtn.style.color = '#ffffff';
            weeklyBtn.style.fontWeight = '600';
        } else {
            weeklyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            weeklyBtn.style.color = '#4a90e2';
            weeklyBtn.style.fontWeight = '500';
        }
    }

    if (monthlyBtn) {
        if (view === 'monthly') {
            monthlyBtn.style.background = '#4a90e2';
            monthlyBtn.style.color = '#ffffff';
            monthlyBtn.style.fontWeight = '600';
        } else {
            monthlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            monthlyBtn.style.color = '#4a90e2';
            monthlyBtn.style.fontWeight = '500';
        }
    }

    if (annualBtn) {
        if (view === 'annual') {
            annualBtn.style.background = '#4a90e2';
            annualBtn.style.color = '#ffffff';
            annualBtn.style.fontWeight = '600';
        } else {
            annualBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            annualBtn.style.color = '#4a90e2';
            annualBtn.style.fontWeight = '500';
        }
    }

    if (yearlyBtn) {
        if (view === 'yearly') {
            yearlyBtn.style.background = '#4a90e2';
            yearlyBtn.style.color = '#ffffff';
            yearlyBtn.style.fontWeight = '600';
        } else {
            yearlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            yearlyBtn.style.color = '#4a90e2';
            yearlyBtn.style.fontWeight = '500';
        }
    }

    updateProfitChart();
}

// Update customer chart based on current customer chart view
function updateCustomerChart() {
    if (!customerChart) {
        if (!salesChart || !profitChart || !customerChart) {
            initCharts();
        }
    }

    const sales = Storage.get('sales') || [];

    let labels = [];
    let customerData = [];

    if (currentCustomerChartView === 'daily') {
        // Daily view: Group by hours (0-23)
        labels = Array.from({ length: 24 }, (_, i) => {
            if (i === 0) return '12am';
            if (i === 12) return '12pm';
            if (i < 12) return `${i}am`;
            return `${i - 12}pm`;
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        customerData = new Array(24).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= today && saleDate <= todayEnd) {
                const hour = saleDate.getHours();
                customerData[hour] += 1;
            }
        });

    } else if (currentCustomerChartView === 'weekly') {
        // Weekly view: Group by days (current week starting from Monday)
        const now = new Date();
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

        const monday = new Date(now);
        monday.setDate(now.getDate() - daysFromMonday);
        monday.setHours(0, 0, 0, 0);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            date.setHours(0, 0, 0, 0);
            days.push(date);
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            labels.push(dayNames[date.getDay()] + ' ' + date.getDate());
        }

        customerData = new Array(7).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            saleDate.setHours(0, 0, 0, 0);
            const dayIndex = days.findIndex(d => d.getTime() === saleDate.getTime());
            if (dayIndex !== -1) {
                customerData[dayIndex] += 1;
            }
        });

    } else if (currentCustomerChartView === 'monthly') {
        // Monthly view: Group by weeks (last 4 weeks)
        const now = new Date();
        const weeks = [];
        for (let i = 3; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            weeks.push({ start: weekStart, end: weekEnd });
            labels.push(`Week ${4 - i}`);
        }

        customerData = new Array(4).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const weekIndex = weeks.findIndex(w => saleDate >= w.start && saleDate <= w.end);
            if (weekIndex !== -1) {
                customerData[weekIndex] += 1;
            }
        });

    } else if (currentCustomerChartView === 'annual') {
        // Annual view: Group by months (last 12 months)
        const now = new Date();
        const months = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        for (let i = 11; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
            const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
            months.push({ start, end });
            labels.push(`${monthNames[start.getMonth()]} '${String(start.getFullYear()).slice(-2)}`);
        }

        customerData = new Array(12).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const monthIndex = months.findIndex(m => saleDate >= m.start && saleDate <= m.end);
            if (monthIndex !== -1) {
                customerData[monthIndex] += 1;
            }
        });

    } else if (currentCustomerChartView === 'yearly') {
        // Yearly view: Group by years
        const now = new Date();
        const currentYear = now.getFullYear();

        // Get all unique years from sales data
        const yearsSet = new Set();
        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            yearsSet.add(saleDate.getFullYear());
        });

        // Create array of years (at least last 5 years, or all years if more)
        const years = Array.from(yearsSet).sort((a, b) => a - b);
        const minYear = Math.min(...years, currentYear - 4);
        const maxYear = Math.max(...years, currentYear);

        for (let year = minYear; year <= maxYear; year++) {
            labels.push(String(year));
        }

        customerData = new Array(labels.length).fill(0);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            const year = saleDate.getFullYear();
            const yearIndex = labels.indexOf(String(year));
            if (yearIndex !== -1) {
                customerData[yearIndex] += 1;
            }
        });
    }

    customerChart.data.labels = labels;
    customerChart.data.datasets[0].data = customerData;
    customerChart.update();

    // Calculate and display percentage comparison
    updateCustomerCountComparison();
}

// Calculate and display customer count percentage comparison
function updateCustomerCountComparison() {
    const sales = Storage.get('sales') || [];
    const comparisonEl = document.getElementById('customerCountComparison');
    if (!comparisonEl) return;

    let currentCount = 0;
    let previousCount = 0;
    let comparisonText = '';

    if (currentCustomerChartView === 'daily') {
        // Today vs Yesterday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= today && saleDate <= todayEnd) {
                currentCount += 1;
            } else if (saleDate >= yesterday && saleDate <= yesterdayEnd) {
                previousCount += 1;
            }
        });

        comparisonText = 'yesterday';

    } else if (currentCustomerChartView === 'weekly') {
        // Current week vs Previous week
        const now = new Date();
        const currentDay = now.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

        const currentWeekMonday = new Date(now);
        currentWeekMonday.setDate(now.getDate() - daysFromMonday);
        currentWeekMonday.setHours(0, 0, 0, 0);
        const currentWeekSunday = new Date(currentWeekMonday);
        currentWeekSunday.setDate(currentWeekMonday.getDate() + 6);
        currentWeekSunday.setHours(23, 59, 59, 999);

        const previousWeekMonday = new Date(currentWeekMonday);
        previousWeekMonday.setDate(currentWeekMonday.getDate() - 7);
        const previousWeekSunday = new Date(previousWeekMonday);
        previousWeekSunday.setDate(previousWeekMonday.getDate() + 6);
        previousWeekSunday.setHours(23, 59, 59, 999);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= currentWeekMonday && saleDate <= currentWeekSunday) {
                currentCount += 1;
            } else if (saleDate >= previousWeekMonday && saleDate <= previousWeekSunday) {
                previousCount += 1;
            }
        });

        comparisonText = 'previous week';

    } else if (currentCustomerChartView === 'monthly') {
        // Current month vs Previous month
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentMonthStart.setHours(0, 0, 0, 0);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        currentMonthEnd.setHours(23, 59, 59, 999);

        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousMonthStart.setHours(0, 0, 0, 0);
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousMonthEnd.setHours(23, 59, 59, 999);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= currentMonthStart && saleDate <= currentMonthEnd) {
                currentCount += 1;
            } else if (saleDate >= previousMonthStart && saleDate <= previousMonthEnd) {
                previousCount += 1;
            }
        });

        comparisonText = 'previous month';

    } else if (currentCustomerChartView === 'yearly') {
        // Current year vs Previous year
        const now = new Date();
        const currentYearStart = new Date(now.getFullYear(), 0, 1);
        currentYearStart.setHours(0, 0, 0, 0);
        const currentYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

        const previousYearStart = new Date(now.getFullYear() - 1, 0, 1);
        previousYearStart.setHours(0, 0, 0, 0);
        const previousYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);

        sales.forEach(sale => {
            if (!sale.date) return;
            const saleDate = new Date(sale.date);
            if (saleDate >= currentYearStart && saleDate <= currentYearEnd) {
                currentCount += 1;
            } else if (saleDate >= previousYearStart && saleDate <= previousYearEnd) {
                previousCount += 1;
            }
        });

        comparisonText = 'previous year';
    }

    // Calculate percentage change
    let percentage = 0;
    let displayText = '';

    if (previousCount === 0) {
        if (currentCount > 0) {
            displayText = `100% more than ${comparisonText}`;
        } else {
            displayText = `No change from ${comparisonText}`;
        }
    } else {
        percentage = ((currentCount - previousCount) / previousCount) * 100;
        if (percentage > 0) {
            displayText = `${formatNumber(Math.abs(percentage).toFixed(1))}% more than ${comparisonText}`;
        } else if (percentage < 0) {
            displayText = `${formatNumber(Math.abs(percentage).toFixed(1))}% less than ${comparisonText}`;
        } else {
            displayText = `No change from ${comparisonText}`;
        }
    }

    comparisonEl.textContent = displayText;
}

// Change customer chart view
window.changeCustomerChartView = (view) => {
    currentCustomerChartView = view;

    // Update button styles
    const dailyBtn = document.getElementById('customerChartViewDaily');
    const weeklyBtn = document.getElementById('customerChartViewWeekly');
    const monthlyBtn = document.getElementById('customerChartViewMonthly');
    const annualBtn = document.getElementById('customerChartViewAnnual');
    const yearlyBtn = document.getElementById('customerChartViewYearly');

    if (dailyBtn) {
        if (view === 'daily') {
            dailyBtn.style.background = '#4a90e2';
            dailyBtn.style.color = '#ffffff';
            dailyBtn.style.fontWeight = '600';
        } else {
            dailyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            dailyBtn.style.color = '#4a90e2';
            dailyBtn.style.fontWeight = '500';
        }
    }

    if (weeklyBtn) {
        if (view === 'weekly') {
            weeklyBtn.style.background = '#4a90e2';
            weeklyBtn.style.color = '#ffffff';
            weeklyBtn.style.fontWeight = '600';
        } else {
            weeklyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            weeklyBtn.style.color = '#4a90e2';
            weeklyBtn.style.fontWeight = '500';
        }
    }

    if (monthlyBtn) {
        if (view === 'monthly') {
            monthlyBtn.style.background = '#4a90e2';
            monthlyBtn.style.color = '#ffffff';
            monthlyBtn.style.fontWeight = '600';
        } else {
            monthlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            monthlyBtn.style.color = '#4a90e2';
            monthlyBtn.style.fontWeight = '500';
        }
    }

    if (annualBtn) {
        if (view === 'annual') {
            annualBtn.style.background = '#4a90e2';
            annualBtn.style.color = '#ffffff';
            annualBtn.style.fontWeight = '600';
        } else {
            annualBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            annualBtn.style.color = '#4a90e2';
            annualBtn.style.fontWeight = '500';
        }
    }

    if (yearlyBtn) {
        if (view === 'yearly') {
            yearlyBtn.style.background = '#4a90e2';
            yearlyBtn.style.color = '#ffffff';
            yearlyBtn.style.fontWeight = '600';
        } else {
            yearlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            yearlyBtn.style.color = '#4a90e2';
            yearlyBtn.style.fontWeight = '500';
        }
    }

    updateCustomerChart();
    updateCustomerCountComparison();
}

// Change chart view
window.changeChartView = (view) => {
    currentChartView = view;

    // Update button styles
    const dailyBtn = document.getElementById('chartViewDaily');
    const weeklyBtn = document.getElementById('chartViewWeekly');
    const monthlyBtn = document.getElementById('chartViewMonthly');

    if (dailyBtn) {
        if (view === 'daily') {
            dailyBtn.style.background = '#4a90e2';
            dailyBtn.style.color = '#ffffff';
            dailyBtn.style.fontWeight = '600';
        } else {
            dailyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            dailyBtn.style.color = '#4a90e2';
            dailyBtn.style.fontWeight = '500';
        }
    }

    if (weeklyBtn) {
        if (view === 'weekly') {
            weeklyBtn.style.background = '#4a90e2';
            weeklyBtn.style.color = '#ffffff';
            weeklyBtn.style.fontWeight = '600';
        } else {
            weeklyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            weeklyBtn.style.color = '#4a90e2';
            weeklyBtn.style.fontWeight = '500';
        }
    }

    if (monthlyBtn) {
        if (view === 'monthly') {
            monthlyBtn.style.background = '#4a90e2';
            monthlyBtn.style.color = '#ffffff';
            monthlyBtn.style.fontWeight = '600';
        } else {
            monthlyBtn.style.background = 'rgba(74, 144, 226, 0.1)';
            monthlyBtn.style.color = '#4a90e2';
            monthlyBtn.style.fontWeight = '500';
        }
    }

    updateCharts();
}

window.showUnbookConfirmation = (cardElement, tableId) => {
    // Cancel any existing pending unbook
    if (pendingUnbookCard && pendingUnbookCard !== cardElement) {
        cancelUnbookConfirmation();
    }

    pendingUnbookAction = () => unbookTableConfirmed(tableId);
    pendingUnbookCard = cardElement;

    // Remove existing confirmation container if any
    const existingContainer = cardElement.querySelector('.unbook-confirmation-container');
    if (existingContainer) {
        existingContainer.remove();
    }

    // Hide the "Unbook" button
    const unbookButton = cardElement.querySelector('.unbook-btn');
    if (unbookButton) {
        unbookButton.style.display = 'none';
    }

    // Create confirmation container
    const container = document.createElement('div');
    container.className = 'unbook-confirmation-container';
    container.style.cssText = 'display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 8px; padding: 8px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;';
    container.onclick = (e) => e.stopPropagation(); // Prevent opening booking modal
    container.innerHTML = `
        <span style="font-size: 12px; font-weight: 600; color: #6b7280; margin-right: 4px; font-family: \'Poppins\', \'Inter\', sans-serif;">Unbook?</span>
        <button type="button" onclick="event.stopPropagation(); confirmUnbook();" style="background: #4caf50; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Confirm">✓</button>
        <button type="button" onclick="event.stopPropagation(); cancelUnbookConfirmation();" style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 12px; min-width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; line-height: 1;" title="Cancel">✕</button>
    `;

    // Insert before the action buttons
    const actionButtonsDiv = cardElement.querySelector('div[style*="display: flex; gap: 6px"]');
    if (actionButtonsDiv) {
        actionButtonsDiv.parentNode.insertBefore(container, actionButtonsDiv);
    } else {
        cardElement.appendChild(container);
    }

    unbookConfirmationContainer = container;
};

window.confirmUnbook = () => {
    if (pendingUnbookAction) {
        pendingUnbookAction();
        cancelUnbookConfirmation();
    }
};

window.cancelUnbookConfirmation = () => {
    if (unbookConfirmationContainer && pendingUnbookCard) {
        unbookConfirmationContainer.remove();

        // Restore the "Unbook" button
        const unbookButton = pendingUnbookCard.querySelector('.unbook-btn');
        if (unbookButton) {
            unbookButton.style.display = '';
        }
    }

    pendingUnbookAction = null;
    pendingUnbookCard = null;
    unbookConfirmationContainer = null;
};

function unbookTableConfirmed(id) {
    const tables = Storage.get('tables') || [];
    const table = tables.find(t => String(t.id) === String(id));
    if (table) {
        table.status = 'available';
        table.customerName = null;
        table.customerContact = null;
        Storage.set('tables', tables);
        loadTables();
    }
}

window.unbookTable = (id) => {
    unbookTableConfirmed(id);
};

// Functions are already assigned to window above

// POS Category Colors
const categoryColors = ['#e74c3c', '#9b59b6', '#e91e63', '#8b4513', '#3498db', '#27ae60', '#c0392b', '#8e44ad', '#f39c12', '#16a085'];
let colorIndex = 0;

let selectedCategory = 'favorites';
let menuItemQuantities = {}; // Track quantities for each menu item
let draggedElement = null; // Track element being dragged
window.searchQuery = ''; // Track search query
let searchQuery = window.searchQuery; // Alias for backward compatibility
window.positionManagementMode = false; // Track if position management mode is active

// Favorites Management
window.addToFavorites = (itemId) => {
    let favorites = Storage.get('favorites') || [];
    if (!favorites.includes(itemId)) {
        favorites.push(itemId);
        Storage.set('favorites', favorites);
        loadMenuItemsList();
        // Reload categories if POS tab is active
        if (document.getElementById('pos')?.classList.contains('active')) {
            loadCategories();
            loadMenuItems();
        }
    }
};

window.removeFromFavorites = (itemId) => {
    let favorites = Storage.get('favorites') || [];
    favorites = favorites.filter(id => id !== itemId);
    Storage.set('favorites', favorites);
    loadMenuItemsList();
    // Reload categories if POS tab is active
    if (document.getElementById('pos')?.classList.contains('active')) {
        loadCategories();
        // If currently viewing favorites, reload menu items
        if (selectedCategory === 'favorites') {
            selectedCategory = 'all';
            loadCategories();
            loadMenuItems();
        } else {
            loadMenuItems();
        }
    }
};

// POS Functions
function loadCategories() {
    const categoryButtons = document.getElementById('categoryButtons');
    if (!categoryButtons) return;

    const menuCategories = Storage.get('menuCategories');
    const favorites = Storage.get('favorites') || [];
    categoryButtons.innerHTML = '';

    // Add "Favourites" button first (only if there are favorites)
    const favoritesCount = favorites.length;
    if (favoritesCount > 0) {
        const favoritesBtn = document.createElement('button');
        const isFavoritesActive = selectedCategory === 'favorites';
        favoritesBtn.className = `category-btn ${isFavoritesActive ? 'active' : ''}`;
        favoritesBtn.style.background = '#f39c12';
        favoritesBtn.onclick = () => selectCategory('favorites');

        favoritesBtn.innerHTML = `
            <span class="category-btn-text">Favourites (${favoritesCount})</span>
        `;
        categoryButtons.appendChild(favoritesBtn);
    } else if (selectedCategory === 'favorites') {
        // If favorites was selected but is now empty, switch to 'all'
        selectedCategory = 'all';
    }

    // Add "All" button
    const allBtn = document.createElement('button');
    const isAllActive = selectedCategory === 'all';
    allBtn.className = `category-btn ${isAllActive ? 'active' : ''}`;
    allBtn.style.background = '#4a90e2';
    allBtn.onclick = () => selectCategory('all');

    const menuItems = Storage.get('menuItems');
    const allCount = menuItems.length;

    allBtn.innerHTML = `
        <span class="category-btn-text">All (${allCount})</span>
    `;
    categoryButtons.appendChild(allBtn);

    // Add category buttons (only if they have items)
    menuCategories.forEach((cat, index) => {
        const menuItems = Storage.get('menuItems');
        const count = menuItems.filter(item => {
            // Ensure both are numbers for comparison
            const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
            const catId = typeof cat.id === 'number' ? cat.id : parseInt(cat.id);
            return itemCategoryId === catId;
        }).length;

        // Skip empty categories
        if (count === 0) {
            // If this category was selected but is now empty, switch to 'all'
            const catId = typeof cat.id === 'number' ? cat.id : parseInt(cat.id);
            if ((typeof selectedCategory === 'number' && selectedCategory === catId) ||
                (typeof selectedCategory === 'string' && parseInt(selectedCategory) === catId)) {
                selectedCategory = 'all';
            }
            return;
        }

        const color = categoryColors[index % categoryColors.length];
        const catId = typeof cat.id === 'number' ? cat.id : parseInt(cat.id);
        const isActive = typeof selectedCategory === 'number'
            ? selectedCategory === catId
            : selectedCategory === 'all' ? false : parseInt(selectedCategory) === catId;

        const btn = document.createElement('button');
        btn.className = `category-btn ${isActive ? 'active' : ''}`;
        btn.style.background = color;
        btn.onclick = () => selectCategory(catId);
        btn.innerHTML = `
            <span class="category-btn-text">${cat.name} (${count})</span>
        `;
        categoryButtons.appendChild(btn);
    });
}

function selectCategory(categoryId) {
    // Ensure selectedCategory is stored correctly
    if (categoryId === 'all') {
        selectedCategory = 'all';
    } else if (categoryId === 'favorites') {
        selectedCategory = 'favorites';
    } else {
        selectedCategory = typeof categoryId === 'number' ? categoryId : parseInt(categoryId);
    }
    // Clear search when switching categories
    window.searchQuery = '';
    searchQuery = '';
    const menuSearchInput = document.getElementById('menuSearch');
    if (menuSearchInput) {
        menuSearchInput.value = '';
    }
    loadCategories();
    loadMenuItems();
}

window.loadMenuItems = function loadMenuItems() {
    const menuItems = Storage.get('menuItems');
    const favorites = Storage.get('favorites') || [];

    let filteredItems;

    // If search query exists, search through entire menu regardless of category
    if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        filteredItems = menuItems.filter(item =>
            item.name.toLowerCase().includes(query)
        );
    } else {
        // Apply category filter only when there's no search query
        if (selectedCategory === 'all') {
            filteredItems = menuItems;
        } else if (selectedCategory === 'favorites') {
            // Show only favorite items
            filteredItems = menuItems.filter(item => favorites.includes(item.id));
        } else {
            filteredItems = menuItems.filter(item => {
                // Ensure both are numbers for comparison
                const itemCategoryId = typeof item.categoryId === 'number' ? item.categoryId : parseInt(item.categoryId);
                const selectedCatId = typeof selectedCategory === 'number' ? selectedCategory : parseInt(selectedCategory);
                return itemCategoryId === selectedCatId;
            });
        }
    }

    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;

    menuGrid.innerHTML = '';

    if (filteredItems.length === 0) {
        menuGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">No menu items available. Add items in the Menu section.</div>';
        return;
    }

    // Get saved order for current category
    let itemOrder = Storage.get('menuItemOrder');
    if (!itemOrder || typeof itemOrder !== 'object') {
        itemOrder = {};
    }

    const categoryKey = selectedCategory === 'all' ? 'all' :
        selectedCategory === 'favorites' ? 'favorites' :
            selectedCategory.toString();
    let savedOrder = itemOrder[categoryKey] ? [...itemOrder[categoryKey]] : [];

    // Filter saved order to only include items that still exist in filteredItems
    const existingInSavedOrder = savedOrder.filter(id => filteredItems.some(item => item.id === id));

    // Find items not in saved order (new items or items that were removed and re-added)
    const missingItems = filteredItems.filter(item => !savedOrder.includes(item.id));

    // Build final order: existing items in saved order first, then missing items at the end
    let finalOrder = [...existingInSavedOrder];
    if (missingItems.length > 0) {
        missingItems.forEach(item => finalOrder.push(item.id));
        // Update saved order with new items
        itemOrder[categoryKey] = finalOrder;
        Storage.set('menuItemOrder', itemOrder);
    } else if (existingInSavedOrder.length > 0 && existingInSavedOrder.length !== savedOrder.length) {
        // Some items were removed, update the saved order
        itemOrder[categoryKey] = existingInSavedOrder;
        Storage.set('menuItemOrder', itemOrder);
        finalOrder = existingInSavedOrder;
    } else if (finalOrder.length === 0 && filteredItems.length > 0) {
        // No saved order exists, create one from current items
        finalOrder = filteredItems.map(item => item.id);
        itemOrder[categoryKey] = finalOrder;
        Storage.set('menuItemOrder', itemOrder);
    }

    // Use finalOrder for sorting
    const orderToUse = finalOrder.length > 0 ? finalOrder : filteredItems.map(item => item.id);

    // Sort items according to saved order
    const sortedItems = [...filteredItems].sort((a, b) => {
        const indexA = orderToUse.indexOf(a.id);
        const indexB = orderToUse.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1; // a comes after b
        if (indexB === -1) return -1; // b comes after a
        return indexA - indexB; // Both in saved order, use their positions
    });

    // Create placeholder image data URI (simple gray placeholder with plate icon)
    const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RkZCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTcwIDEwMEwxMDAgNzBMMTMwIDEwMEwxMDAgMTMwWiIgZmlsbD0iI2RkZCIvPjwvc3ZnPg==';

    // Use requestAnimationFrame for smoother rendering
    const renderBatch = (startIndex) => {
        const batchSize = 10; // Render 10 items per frame
        const endIndex = Math.min(startIndex + batchSize, sortedItems.length);

        for (let i = startIndex; i < endIndex; i++) {
            const item = sortedItems[i];
            const cartItem = cart.find(cartItem => cartItem.id === item.id);
            const quantity = cartItem ? cartItem.quantity : (menuItemQuantities[item.id] || 0);

            const card = document.createElement('div');
            card.className = 'menu-item-card';
            card.dataset.itemId = item.id;

            // Always load images immediately, compress in background
            const imageSrc = item.image || placeholderImage;

            card.innerHTML = `
                <div class="menu-item-image-container">
                    <img src="${imageSrc}" 
                         alt="${item.name}" 
                         class="menu-item-image"
                         loading="lazy"
                         onerror="this.src='${placeholderImage}'">
                </div>
                <div class="menu-item-header">
                    <div class="menu-item-name">${item.name}</div>
                </div>
                <div class="menu-item-price">Rs.${formatNumber(item.price)}</div>
                ${quantity > 0 ? `<div class="menu-item-quantity-counter">x${formatQuantity(quantity)}</div>` : ''}
            `;

            // Compress images in background for better performance
            if (item.image && !imageSrc.startsWith('data:image/svg+xml')) {
                const img = card.querySelector('img');
                if (img) {
                    // Show original immediately, then replace with compressed version when ready
                    compressImageForDisplay(imageSrc, 200, 200, 0.6, (compressedSrc) => {
                        if (img.parentElement && img.src === imageSrc) { // Only replace if still showing original
                            img.src = compressedSrc;
                            img.classList.add('loaded');
                        }
                    });
                }
            }

            // Add click event to add item to cart (only if not in position management mode)
            card.addEventListener('click', function (e) {
                if (!window.positionManagementMode) {
                    // Add item to cart
                    updateMenuQuantity(item.id, 1);
                }
            });

            // Add right-click event to reduce quantity by 1
            card.addEventListener('contextmenu', function (e) {
                e.preventDefault(); // Prevent default context menu
                if (!window.positionManagementMode) {
                    updateMenuQuantity(item.id, -1);
                }
            });

            // Enable drag-and-drop if position management mode is active
            if (window.positionManagementMode) {
                card.draggable = true;
                card.addEventListener('dragstart', handleDragStart);
                card.addEventListener('dragend', handleDragEnd);
                card.addEventListener('dragover', handleDragOver);
                card.addEventListener('dragenter', handleDragEnter);
                card.addEventListener('dragleave', handleDragLeave);
                card.addEventListener('drop', handleDrop);
                card.style.cursor = 'move';
            }

            menuGrid.appendChild(card);
        }

        // Continue with next batch if there are more items
        if (endIndex < sortedItems.length) {
            requestAnimationFrame(() => renderBatch(endIndex));
        } else {
            // All items rendered, setup lazy loading
            setTimeout(() => {
                setupLazyLoading();
            }, 100);
        }
    };

    // Start rendering in batches
    if (sortedItems.length > 0) {
        renderBatch(0);
    } else {
        setTimeout(() => {
            setupLazyLoading();
        }, 100);
    }

    // Also setup lazy loading on scroll (for images that become visible)
    const menuContainer = document.querySelector('.menu-items-container');
    if (menuContainer) {
        const scrollHandler = debounce(() => {
            setupLazyLoading();
        }, 200);
        menuContainer.addEventListener('scroll', scrollHandler);
    }

    // Pre-compress images in background for better performance
    setTimeout(() => {
        sortedItems.forEach(item => {
            if (item.image && !item.image.startsWith('data:image/svg+xml')) {
                // Pre-compress and cache images that are likely to be viewed
                compressImageForDisplay(item.image, 200, 200, 0.6, () => { });
            }
        });
    }, 500);

    // Check if content overflows and conditionally enable scrolling
    updateMenuItemsScrollability();
}

// Helper function to update menu items container scrollability
function updateMenuItemsScrollability() {
    const menuItemsContainer = document.querySelector('.menu-items-container');
    if (menuItemsContainer) {
        // Use requestAnimationFrame to ensure DOM is updated
        requestAnimationFrame(() => {
            const containerHeight = menuItemsContainer.clientHeight;
            const contentHeight = menuItemsContainer.scrollHeight;

            // Only enable scrolling if content actually overflows
            if (contentHeight > containerHeight) {
                menuItemsContainer.style.overflowY = 'auto';
            } else {
                menuItemsContainer.style.overflowY = 'hidden';
            }
        });
    }
}

// Add resize listener to update scrollability when window is resized
window.addEventListener('resize', () => {
    if (document.getElementById('pos')?.classList.contains('active')) {
        updateMenuItemsScrollability();
    }
});

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    // Prevent quantity buttons from interfering with drag
    e.dataTransfer.setData('text/plain', '');
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.menu-item-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (e.preventDefault) {
        e.preventDefault();
    }

    if (draggedElement !== this) {
        const menuGrid = document.getElementById('menuGrid');
        const allCards = Array.from(menuGrid.querySelectorAll('.menu-item-card'));
        const draggedIndex = allCards.indexOf(draggedElement);
        const targetIndex = allCards.indexOf(this);

        if (draggedIndex < targetIndex) {
            menuGrid.insertBefore(draggedElement, this.nextSibling);
        } else {
            menuGrid.insertBefore(draggedElement, this);
        }

        // Save new order immediately
        saveItemOrder();
    }

    this.classList.remove('drag-over');
    return false;
}

function saveItemOrder() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;

    const cards = Array.from(menuGrid.querySelectorAll('.menu-item-card'));
    const itemIds = cards.map(card => parseInt(card.dataset.itemId));

    // Only save if we have items
    if (itemIds.length === 0) return;

    // Get current order
    let itemOrder = Storage.get('menuItemOrder');
    if (!itemOrder || typeof itemOrder !== 'object') {
        itemOrder = {};
    }

    const categoryKey = selectedCategory === 'all' ? 'all' : selectedCategory.toString();

    // Save the exact order as it appears in the DOM
    itemOrder[categoryKey] = itemIds;

    // Save immediately
    Storage.set('menuItemOrder', itemOrder);
}

function updateMenuQuantity(itemId, change) {
    const menuItems = Storage.get('menuItems');
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const cartItem = cart.find(cartItem => cartItem.id === itemId);
    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            removeFromCart(itemId);
        }
    } else if (change > 0) {
        addToCart(item);
    }

    updateCart();

    // Update quantity display without rebuilding entire grid to preserve order
    const menuGrid = document.getElementById('menuGrid');
    if (menuGrid) {
        const card = menuGrid.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
            const currentCartItem = cart.find(cartItem => cartItem.id === itemId);
            const quantity = currentCartItem ? currentCartItem.quantity : (menuItemQuantities[itemId] || 0);

            // Update quantity counter
            let counter = card.querySelector('.menu-item-quantity-counter');
            if (quantity > 0) {
                if (!counter) {
                    counter = document.createElement('div');
                    counter.className = 'menu-item-quantity-counter';
                    card.appendChild(counter);
                }
                counter.textContent = `x${formatQuantity(quantity)}`;
            } else {
                if (counter) {
                    counter.remove();
                }
            }

            const qtyDisplay = card.querySelector('.menu-qty-display');
            if (qtyDisplay) {
                // Update input value - use empty string for 0 to show placeholder
                qtyDisplay.value = quantity === 0 ? '' : quantity;
                return; // Successfully updated, don't reload
            }

            // If no qtyDisplay but counter was updated, return anyway
            if (counter || quantity === 0) {
                return;
            }
        }
        // Only reload if card doesn't exist (shouldn't happen in normal flow)
        // But preserve order by not reloading unnecessarily
    }
    // Only reload if menuGrid doesn't exist (tab not active)
}

// Function to set quantity directly from input
window.setMenuQuantity = function (itemId, quantity) {
    const menuItems = Storage.get('menuItems');
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    quantity = parseFloat(quantity) || 0;
    quantity = Math.max(0, quantity); // Ensure non-negative

    const cartItem = cart.find(cartItem => cartItem.id === itemId);

    if (quantity <= 0) {
        // Remove from cart if quantity is 0
        if (cartItem) {
            removeFromCart(itemId);
        }
    } else {
        // Set quantity
        if (cartItem) {
            cartItem.quantity = quantity;
        } else {
            // Add to cart with specified quantity
            addToCart(item);
            const newCartItem = cart.find(cartItem => cartItem.id === itemId);
            if (newCartItem) {
                newCartItem.quantity = quantity;
            }
        }
    }

    updateCart();

    // Update quantity display without rebuilding entire grid to preserve order
    const menuGrid = document.getElementById('menuGrid');
    if (menuGrid) {
        const card = menuGrid.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
            const qtyDisplay = card.querySelector('.menu-qty-display');
            if (qtyDisplay) {
                // Use empty string for 0 to show placeholder
                qtyDisplay.value = quantity === 0 ? '' : quantity;
            }
        }
    }
};

function addToCart(itemIdOrItem) {
    const menuItems = Storage.get('menuItems');
    const item = typeof itemIdOrItem === 'number'
        ? menuItems.find(i => i.id === itemIdOrItem)
        : itemIdOrItem;

    if (!item) return;

    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1
        });
    }
    updateCart();
    loadMenuItems();
}

function removeFromCart(dishId) {
    cart = cart.filter(item => item.id !== dishId);
    updateCart();
    loadMenuItems();
}

// Function to set cart quantity directly from input
window.setCartQuantityDirect = function (itemId, quantity) {
    const cartItem = cart.find(item => item.id === itemId);
    if (!cartItem) return;

    quantity = parseFloat(quantity) || 0;
    quantity = Math.max(0, quantity); // Ensure minimum 0

    if (quantity <= 0) {
        removeFromCart(itemId);
    } else {
        cartItem.quantity = quantity;
        updateCart();
    }
};

window.setCartPriceDirect = function (itemId, totalSellPrice) {
    const cartItem = cart.find(item => item.id === itemId);
    if (!cartItem) return;

    totalSellPrice = parseFloat(totalSellPrice) || 0;
    const basePrice = cartItem.price;

    if (basePrice > 0) {
        cartItem.quantity = totalSellPrice / basePrice;
        if (cartItem.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCart();
        }
    }
};

function updateQuantity(dishId, change) {
    const item = cart.find(item => item.id === dishId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(dishId);
        } else {
            updateCart();
            loadMenuItems();
        }
    }
}

// Show discount modal
function showDiscountModal() {
    document.getElementById('discountModal').style.display = 'block';
    document.getElementById('discountValue').value = '';
    document.getElementById('discountError').style.display = 'none';
    document.getElementById('discountType').value = 'fixed';
}

// Apply discount to the cart
function applyDiscount() {
    const discountType = document.getElementById('discountType').value;
    const discountValue = parseFloat(document.getElementById('discountValue').value);
    const errorElement = document.getElementById('discountError');

    // Validate discount value
    if (isNaN(discountValue) || discountValue <= 0) {
        errorElement.textContent = 'Please enter a valid discount amount';
        errorElement.style.display = 'block';
        return;
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
        errorElement.textContent = 'Percentage must be between 0 and 100';
        errorElement.style.display = 'block';
        return;
    }

    // Save discount and update cart
    currentDiscount = { type: discountType, value: discountValue };
    document.getElementById('discountModal').style.display = 'none';
    updateCart();
}

// Clear any applied discount
function clearDiscount() {
    currentDiscount = { type: null, value: 0 };
    updateCart();
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const orderHeaderTitle = document.getElementById('orderHeaderTitle');
    const orderSummary = document.querySelector('.order-summary');

    if (!cartItems) return;

    // Update order header with items count
    if (orderHeaderTitle) {
        orderHeaderTitle.textContent = `Order Details (${cart.length})`;
    }

    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">No items in cart</div>';
        if (cartTotal) cartTotal.textContent = 'Rs.0';
        // Reset discount when cart is empty
        currentDiscount = { type: null, value: 0 };
        // Reset discount display
        if (orderSummary) {
            orderSummary.innerHTML = `
                <div class="summary-item discount-row">
                    <span>Discount</span>
                    <a href="#" id="applyDiscount" style="color: #4a90e2; text-decoration: none; font-weight: 600;" onclick="showDiscountModal(); return false;">Apply</a>
                </div>
                <div class="summary-item subtotal-row">
                    <span>Subtotal</span>
                    <span>Rs.0</span>
                </div>
                <div class="summary-item tax-row" style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span>GST (5%): Rs.0</span>
                    <span>Serv. Charges (10%): Rs.0</span>
                </div>
                <div class="summary-item total-row">
                    <span>Total</span>
                    <span id="cartTotal">Rs.0</span>
                </div>`;
        }
        return;
    }

    cartItems.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div class="order-item-left">
                <div class="order-item-name">${item.name}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="order-item-qty">x${formatQuantity(item.quantity)}</div>
                    <div class="order-item-price">Rs.${formatNumber(itemTotal)}</div>
                </div>
            </div>
            <div class="order-item-right">
                <div class="order-item-actions">
                    <button class="order-action-btn order-item-remove" onclick="removeFromCart(${item.id})">🗑️</button>
                    <button class="order-action-btn order-item-subtract" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <input type="number" class="order-item-qty-input" value="${item.quantity}" min="0" step="0.01" data-original-value="${item.quantity}" onchange="setCartQuantityDirect(${item.id}, parseFloat(this.value) || 0); this.setAttribute('data-original-value', this.value);" onblur="if(this.value === '' || parseFloat(this.value) <= 0) { this.value = this.getAttribute('data-original-value') || 1; setCartQuantityDirect(${item.id}, parseFloat(this.value) || 1); }" onclick="event.stopPropagation();">
                    <input type="number" class="order-item-price-input" value="${Math.round(itemTotal)}" min="0" step="1" onchange="setCartPriceDirect(${item.id}, this.value)" onclick="event.stopPropagation();">
                    <button class="order-action-btn order-item-add" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
        cartItems.appendChild(orderItem);
    });

    // Calculate discount amount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Update order summary with discount and total
    if (orderSummary) {
        let discountHtml = '';
        if (currentDiscount.type) {
            const discountText = currentDiscount.type === 'fixed'
                ? `Rs.${formatNumber(currentDiscount.value)}`
                : `${currentDiscount.value}%`;
            discountHtml = `
                <div class="summary-item discount-row">
                    <span>Discount (${currentDiscount.type === 'fixed' ? 'Fixed' : 'Percentage'})</span>
                    <div>
                        <span style="color: #e74c3c; margin-right: 10px;">-Rs.${formatNumber(discountAmount)}</span>
                        <span style="color:#999; font-size: 12px; margin-right: 10px;">(${discountText})</span>
                        <a href="#" onclick="clearDiscount()" style="color: #e74c3c; text-decoration: none; font-weight: 600; font-size: 14px;">Remove</a>
                    </div>
                </div>`;
        } else {
            discountHtml = `
                <div class="summary-item discount-row">
                    <span>Discount</span>
                    <a href="#" id="applyDiscount" style="color: #4a90e2; text-decoration: none; font-weight: 600;" onclick="showDiscountModal(); return false;">Apply</a>
                </div>`;
        }

        // Calculate GST (5%) and service charges (10% of subtotal after discount)
        // Exclude for Parcel/Delivery orders
        const discountedSubtotal = Math.max(0, subtotal - discountAmount);
        const salesTax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
        const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
        const grandTotal = discountedSubtotal + salesTax + serviceCharges;

        orderSummary.innerHTML = `
            ${discountHtml}
            <div class="summary-item subtotal-row">
                <span>Subtotal</span>
                <span>Rs.${formatNumber(subtotal)}</span>
            </div>
            <div class="summary-item tax-row" style="display: flex; justify-content: space-between; font-size: 13px;">
                <span>GST (5%): Rs.${formatNumber(salesTax)}</span>
                <span>Serv. Charges (10%): Rs.${formatNumber(serviceCharges)}</span>
            </div>
            <div class="summary-item total-row">
                <span>Total</span>
                <span id="cartTotal">Rs.${formatNumber(grandTotal)}</span>
            </div>`;

        // Re-attach event listener to the Apply Discount link
        const applyDiscountLink = document.getElementById('applyDiscount');
        if (applyDiscountLink) {
            applyDiscountLink.addEventListener('click', (e) => {
                e.preventDefault();
                showDiscountModal();
            });
        }
    } else if (cartTotal) {
        const discountedSubtotal = Math.max(0, subtotal - discountAmount);
        const salesTax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
        const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
        const grandTotal = discountedSubtotal + salesTax + serviceCharges;
        cartTotal.textContent = `Rs.${formatNumber(grandTotal)}`;
    }
}

function clearCart() {
    if (confirm('Clear all items from cart?')) {
        cart = [];
        updateCart();
    }
}

let selectedPaymentMethod = 'cash';

function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    const cashBtn = document.querySelector('.cash-btn');
    const onlineBtn = document.querySelector('.online-btn');
    const deliveryBtn = document.querySelector('.delivery-btn');

    // Reset all buttons to inactive state
    [cashBtn, onlineBtn, deliveryBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#666';
            btn.style.border = '1px solid transparent';
            btn.style.fontWeight = '500';
            btn.style.boxShadow = 'none';
        }
    });

    // Set active button
    let activeBtn = null;
    if (method === 'cash' && cashBtn) {
        activeBtn = cashBtn;
    } else if (method === 'online' && onlineBtn) {
        activeBtn = onlineBtn;
    } else if (method === 'delivery' && deliveryBtn) {
        activeBtn = deliveryBtn;
    }

    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = '#8B4513';
        activeBtn.style.color = '#ffffff';
        activeBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        activeBtn.style.fontWeight = '600';
        activeBtn.style.boxShadow = '0 2px 4px rgba(139, 69, 19, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
    }

    // Update cart to recalculate tax when payment method changes
    updateCart();
}

function holdOrder() {
    if (cart.length === 0) {
        const holdOrderBtn = document.getElementById('holdOrderBtn');
        if (holdOrderBtn) {
            showButtonMessage(holdOrderBtn, 'Cart is empty!');
        }
        return;
    }

    // If editing an order, save changes instead
    if (editingHoldOrderId) {
        saveHoldOrderChanges();
        return;
    }

    // Skip confirmation - directly hold and print
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    // Calculate GST and Service Charges
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SALES_TAX_RATE;
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SERVICE_CHARGE_RATE;
    const total = discountedSubtotal + tax + serviceCharges;

    const holdOrders = Storage.get('holdOrders');
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;
    const now = new Date();

    const displayOrderNumber = (orderNumber || '').toString().padStart(7, '0');

    // Get selected waiter from dropdown
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    const heldOrder = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        date: formatDate(now),
        time: formatTime(now),
        items: cart.map(item => ({ ...item })), // Create a copy
        subtotal: subtotal,
        ...(currentDiscount.type ? {
            discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
        } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        customerName: getCustomerName() || null,
        status: 'pending',
        createdAt: now.toISOString()
    };

    holdOrders.push(heldOrder);
    Storage.set('holdOrders', holdOrders);

    // Build Customer Receipt + KOT from the held order (so it prints even after cart clears)
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;

    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${heldOrder.customerName || '-'}\n`;
    if (heldOrder.tableNo) {
        receipt += `Table No: ${heldOrder.tableNo}\n`;
    }
    receipt += `${t('Location')}: ${formatLocation(heldOrder.paymentMethod)}\n`;
    receipt += `${t('Date')}: ${heldOrder.date} ${heldOrder.time}\n`;
    const receiveTimeReceipt1 = calculateReceiveTime(heldOrder.time, heldOrder.date);
    receipt += `Order Receive Time: ${receiveTimeReceipt1}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(heldOrder.items);
    receipt += formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Build KOT as HTML instead of plain text
    const kotItemsTable = formatKOTItems(heldOrder.items);
    const receiveTime = calculateReceiveTime(heldOrder.time, heldOrder.date);
    const kotHTML = `
        <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
            <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>

            <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Customer: ${heldOrder.customerName ? escapeHtml(heldOrder.customerName) : '-'}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(heldOrder.paymentMethod)}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${heldOrder.date} ${heldOrder.time}</div>
            ${receiveTime ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime}</div>` : ''}
            ${heldOrder.tableNo ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Table No: ${escapeHtml(heldOrder.tableNo)}</div>` : ''}
            ${heldOrder.waiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(heldOrder.waiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
            <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                <div style="width: 100%; display: block;">
                    ${kotItemsTable}
                </div>
            </div>
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                <div style="font-size: 12px; font-weight: 700;">======================</div>
            </div>
        </div>
    `;

    // Store cart data temporarily for undo
    const cartBackup = JSON.parse(JSON.stringify(cart));
    const menuItemQuantitiesBackup = JSON.parse(JSON.stringify(menuItemQuantities));

    // Clear cart
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();
    resetTableSelection();

    // Skip success modal when printing receipts (user requested)
    // showHoldOrderSuccessModal(orderId, heldOrder.id, cartBackup, menuItemQuantitiesBackup);

    // Refresh hold orders if on hold orders tab
    if (document.getElementById('holdOrders')?.classList.contains('active')) {
        loadHoldOrders();
    }

    // Print KOT only (separate window)
    const kotWindow = window.open('', '_blank');
    if (kotWindow) {
        kotWindow.document.write(`
            <html>
                <head>
                    <title>KOT - ${displayOrderNumber}</title>
                    <style>
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            padding: 5px;
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            align-items: center;
                            min-height: auto;
                        }
                        .receipt-logo {
                            max-width: 120px;
                            max-height: 120px;
                            width: auto;
                            height: auto;
                            margin-bottom: 5px;
                            display: block;
                            object-fit: contain;
                        }
                        @media print {
                            body {
                                padding: 2mm 0;
                                min-height: auto;
                                display: block;
                            }
                            .receipt-logo {
                                max-width: 100px;
                                max-height: 100px;
                                margin-bottom: 4px;
                            }
                            @page {
                                size: auto;
                                margin: 2mm;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div id="kotContent">${kotHTML}</div>
                    <script>
                        window.onload = function() {
                            // Delay print to ensure preview renders first
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 100);
                            }, 100);
                        }
                    </script>
                </body>
            </html>
        `);
        kotWindow.document.close();
    }
}

function showHoldOrderSuccessModal(orderId, heldOrderId, cartBackup, menuItemQuantitiesBackup) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('holdOrderSuccessModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'holdOrderSuccessModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Order Held</h3>
                    <span class="modal-close" onclick="closeHoldOrderSuccessModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <p id="holdOrderSuccessMessage"></p>
                </div>
                <div style="padding: 15px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid #e0e0e0;">
                    <button onclick="undoHoldOrder()" style="background: #757575; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: 500;">Undo</button>
                    <button onclick="closeHoldOrderSuccessModal()" style="background: #4a90e2; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-weight: 500;">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('holdOrderSuccessMessage').textContent = `Order ${orderId} has been held successfully!`;

    // Store undo data
    window.pendingUndoData = {
        heldOrderId: heldOrderId,
        cartBackup: cartBackup,
        menuItemQuantitiesBackup: menuItemQuantitiesBackup
    };

    modal.style.display = 'flex';
}

function closeHoldOrderSuccessModal() {
    const modal = document.getElementById('holdOrderSuccessModal');
    if (modal) {
        modal.style.display = 'none';
    }
    window.pendingUndoData = null;
}

function undoHoldOrder() {
    if (!window.pendingUndoData) return;

    const { heldOrderId, cartBackup, menuItemQuantitiesBackup } = window.pendingUndoData;

    // Remove the held order
    const holdOrders = Storage.get('holdOrders');
    const filtered = holdOrders.filter(o => o.id !== heldOrderId);
    Storage.set('holdOrders', filtered);

    // Restore cart
    cart = cartBackup;
    menuItemQuantities = menuItemQuantitiesBackup;
    updateCart();
    loadMenuItems();

    // Close modal
    closeHoldOrderSuccessModal();

    // Refresh hold orders if on hold orders tab
    if (document.getElementById('holdOrders')?.classList.contains('active')) {
        loadHoldOrders();
    }
}

function loadHoldOrders() {
    const holdOrders = Storage.get('holdOrders');
    const tbody = document.getElementById('holdOrdersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Filter only pending orders
    const pendingOrders = holdOrders.filter(order => order.status === 'pending');

    const countEl = document.getElementById('holdOrdersCount');
    if (countEl) countEl.textContent = 'Count: ' + pendingOrders.length;

    if (pendingOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No pending orders</td></tr>';
        return;
    }

    // Sort by date/time (newest first)
    const sortedOrders = [...pendingOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sortedOrders.forEach(order => {
        const itemsList = order.items.map(item => `${item.name} x${item.quantity}`).join(', ');
        const tr = document.createElement('tr');
        const orderDate = order.date ? new Date(order.date) : (order.createdAt ? new Date(order.createdAt) : new Date());
        const dateStr = formatDate(orderDate);
        const timeStr = order.time || formatTime(orderDate);
        const displayOrderNumber = (order.orderNumber || extractOrderNumber(order.orderId || order.id) || '').toString().padStart(7, '0');
        const waiterName = order.waiter ? escapeHtml(order.waiter) : '-';
        const customerName = order.customerName ? escapeHtml(order.customerName) : '-';
        
        let locationText = formatLocation(order.paymentMethod);
        if (order.tableNo) {
            locationText += ` (Table ${order.tableNo})`;
        }

        tr.innerHTML = `
            <td>#${displayOrderNumber}</td>
            <td>${dateStr} ${timeStr}</td>
            <td>${itemsList}</td>
            <td>Rs.${formatNumber(order.total)}</td>
            <td>${locationText}</td>
            <td>${customerName}</td>
            <td>${waiterName}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-edit" onclick="editHoldOrder('${order.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Edit Order">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                    </button>
                    <button id="completeBtn_${order.id}" class="btn-edit" onclick="showCompleteConfirmation('${order.id}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Complete Order">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </button>
                    <button class="btn-edit" onclick="printReceiptForOrder('${order.id}')" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Print Receipt">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    </button>
                    <button class="btn-delete" onclick="deleteHoldOrder('${order.id}', this)" style="background: transparent; border: none; padding: 4px; cursor: pointer; display: inline-flex; align-items: center;" title="Delete Order">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showCompleteConfirmation(orderId, buttonElement) {
    // Replace the Complete button with tick/cross buttons in a container
    const buttonContainer = buttonElement.parentElement;

    // Create a container div to hold both buttons side by side
    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.style.cssText = 'display: flex; gap: 4px; align-items: center;';
    buttonsWrapper.setAttribute('data-order-id', orderId);

    // Create tick and cross buttons
    const tickButton = document.createElement('button');
    tickButton.className = 'btn-edit';
    tickButton.style.cssText = 'background: #4caf50; font-family: "Poppins", "Inter", sans-serif; letter-spacing: 0.1px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 4px; cursor: pointer; color: white; font-size: 14px; font-weight: bold; border: none; min-width: 28px; flex-shrink: 0;';
    tickButton.innerHTML = '✓';
    tickButton.setAttribute('data-order-id', orderId);

    const crossButton = document.createElement('button');
    crossButton.className = 'btn-delete';
    crossButton.style.cssText = 'background: #f44336; font-family: "Poppins", "Inter", sans-serif; letter-spacing: 0.1px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 4px; cursor: pointer; color: white; font-size: 14px; font-weight: bold; border: none; min-width: 28px; flex-shrink: 0;';
    crossButton.innerHTML = '✕';
    crossButton.setAttribute('data-order-id', orderId);

    // Add buttons to wrapper
    buttonsWrapper.appendChild(tickButton);
    buttonsWrapper.appendChild(crossButton);

    tickButton.onclick = () => {
        markOrderSuccessful(orderId, true);
    };

    crossButton.onclick = () => {
        // Restore original Complete button
        const container = buttonsWrapper.parentElement;
        const newCompleteBtn = document.createElement('button');
        newCompleteBtn.id = `completeBtn_${orderId}`;
        newCompleteBtn.className = 'btn-edit';
        newCompleteBtn.style.cssText = 'background: #4caf50; font-family: "Poppins", "Inter", sans-serif; letter-spacing: 0.1px;';
        newCompleteBtn.textContent = 'Complete';
        newCompleteBtn.onclick = () => showCompleteConfirmation(orderId, newCompleteBtn);
        // Replace buttons wrapper with Complete button
        container.replaceChild(newCompleteBtn, buttonsWrapper);
    };

    // Replace Complete button with the buttons wrapper
    buttonElement.replaceWith(buttonsWrapper);
}

function markOrderSuccessful(orderId, skipConfirmation = false) {
    if (!skipConfirmation && !confirm('Mark this order as successful and move to sales?')) {
        return false;
    }

    const holdOrders = Storage.get('holdOrders');
    const order = holdOrders.find(o => o.id === orderId);

    if (!order) {
        alert('Order not found!');
        return false;
    }

    // Move to sales as a single order
    const sales = Storage.get('sales');
    const orderNumber = order.orderNumber || getNextOrderNumber();
    const saleOrderId = order.orderId || `ORD-${orderNumber}`;
    const subtotal = order.subtotal || order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate / preserve discount from held order
    let discountAmount = 0;
    let discountToSave = null;
    if (order.discount && order.discount.type) {
        if (typeof order.discount.amount === 'number') {
            discountAmount = order.discount.amount;
        } else if (order.discount.type === 'fixed') {
            discountAmount = Math.min(Number(order.discount.value || 0), subtotal);
        } else if (order.discount.type === 'percentage') {
            discountAmount = (subtotal * Number(order.discount.value || 0)) / 100;
        }
        if (discountAmount > 0) {
            discountToSave = { type: order.discount.type, value: Number(order.discount.value || 0), amount: discountAmount };
        }
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    // Exclude tax for Parcel/Delivery orders
    const paymentMethod = order.paymentMethod || 'cash';
    const tax = (paymentMethod === 'delivery' || paymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
    const serviceCharges = (paymentMethod === 'delivery' || paymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
    const total = discountedSubtotal + tax + serviceCharges;

    const newSale = {
        id: saleOrderId,
        orderId: saleOrderId,
        orderNumber: orderNumber,
        items: order.items.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        ...(discountToSave ? { discount: discountToSave } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: paymentMethod,
        waiter: order.waiter || null,
        customerName: order.customerName || null,
        tableNo: order.tableNo || null,
        date: order.createdAt || new Date().toISOString()
    };

    sales.push(newSale);
    Storage.set('sales', sales);

    // Update stock quantities based on sale items
    updateStockFromSale(newSale.items);

    // Remove from hold orders
    const filtered = holdOrders.filter(o => o.id !== orderId);
    Storage.set('holdOrders', filtered);

    loadHoldOrders();

    // Refresh sales if on sales tab
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }

    return true;
}

function printReceiptForOrder(orderId) {
    const holdOrders = Storage.get('holdOrders');
    const order = holdOrders.find(o => o.id === orderId);

    if (!order) {
        alert('Order not found!');
        return;
    }

    // Just print the receipt without completing the order
    const displayOrderNumber = (order.orderNumber || extractOrderNumber(order.orderId || order.id) || '').toString().padStart(7, '0');

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${order.customerName || '-'}\n`;
    if (order.tableNo) {
        receipt += `Table No: ${order.tableNo}\n`;
    }
    if (order.waiter) {
        receipt += `Waiter: ${order.waiter}\n`;
    }
    receipt += `${t('Location')}: ${formatLocation(order.paymentMethod)}\n`;
    const orderDate = order.date ? new Date(order.date) : (order.createdAt ? new Date(order.createdAt) : new Date());
    const dateStr = formatDate(orderDate);
    const timeStr = order.time || formatTime(orderDate);
    receipt += `${t('Date')}: ${dateStr} ${timeStr}\n`;
    const receiveTimeReceipt5 = calculateReceiveTime(timeStr, orderDate);
    receipt += `Order Receive Time: ${receiveTimeReceipt5}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(order.items);

    // Calculate discount amount
    const discountAmount = getDiscountAmountFromOrder(order, order.subtotal || 0);

    receipt += formatReceiptSummary(order.subtotal || 0, discountAmount, (order.tax || 0), (order.serviceCharges || 0), order.total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Escape receipt content for embedding in JavaScript string
    const escapedReceipt = receipt
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/\n/g, '\\n')   // Escape newlines
        .replace(/\r/g, '\\r')  // Escape carriage returns
        .replace(/`/g, '\\`');   // Escape backticks

    // Open print dialog - use same format as Sales receipt
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt - ${displayOrderNumber}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        padding: 10px;
                        font-size: 13px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        align-items: center;
                        min-height: auto;
                        margin: 0;
                    }
                    .receipt-logo {
                        max-width: 120px;
                        max-height: 120px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 10px auto;
                        display: block;
                        object-fit: contain;
                    }
                    #receiptContent {
                        text-align: center;
                        white-space: pre-wrap;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        font-weight: bold;
                        font-size: 13px;
                    }
                    .order-id-line {
                        font-size: 16px;
                        font-weight: 700;
                    }
                    .restaurant-heading {
                        font-size: 20px;
                        font-weight: 900;
                    }
                    .items-list {
                        font-size: 9px;
                        font-family: 'Courier New', monospace;
                    }
                    @media print {
                        * {
                            margin: 0;
                            padding: 0;
                        }
                        body {
                            padding: 5mm 0;
                            margin: 0;
                            min-height: auto;
                            display: block;
                            height: auto;
                        }
                        .receipt-logo {
                            max-width: 100px;
                            max-height: 100px;
                            margin: 0 auto 8px auto;
                        }
                        #receiptContent {
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin: 0;
                            padding: 0;
                            line-height: 1.2;
                            font-size: 13px;
                        }
                        #receiptContent table {
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        .order-id-line {
                            font-size: 16px !important;
                            font-weight: 700 !important;
                        }
                        @page {
                            size: auto;
                            margin: 5mm;
                        }
                    }
                </style>
            </head>
            <body>

                <div id="receiptContent" style="text-align: center; white-space: pre-wrap; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-weight: bold; font-size: 13px;"></div>
                <script>
                    window.onload = function() {
                        const receiptDiv = document.getElementById('receiptContent');
                        const receiptContent = '${escapedReceipt}';
                        if (receiptDiv) {
                            // Convert receipt string to HTML, handling tables properly
                            // Split by newlines but preserve HTML tables
                            const lines = receiptContent.split('\\n');
                            let processedLines = [];
                            
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i];
                                
                                // Check if this line contains HTML table tags
                                if (line.includes('<table') || line.includes('</table>') || line.includes('<tr') || line.includes('<td') || line.includes('<th') || line.includes('</tr>') || line.includes('</td>') || line.includes('</th>') || line.includes('<thead') || line.includes('</thead>') || line.includes('<tbody') || line.includes('</tbody>')) {
                                    // This is part of a table, add as-is
                                    processedLines.push(line);
                                } else {
                                    // Regular text line
                                    if (line.trim() === 'ABC Restaurant' || line.includes('ABC Restaurant')) {
                                        processedLines.push('<span class="restaurant-heading">' + line + '</span>');
                                    } else if (line.includes('Order No.:') || line.includes('Order No.') || line.includes('Order ID:') || line.includes('Order ID') || line.includes('Order:')) {
                                        processedLines.push('<span class="order-id-line">' + line + '</span>');
                                    } else {
                                        // Escape HTML entities for plain text lines
                                        processedLines.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                                    }
                                }
                            }
                            
                            // Join lines, but don't add <br> between table lines
                            let html = '';
                            for (let i = 0; i < processedLines.length; i++) {
                                const line = processedLines[i];
                                const isTableLine = line.includes('<table') || line.includes('</table>') || line.includes('<tr') || line.includes('<td') || line.includes('<th') || line.includes('</tr>') || line.includes('</td>') || line.includes('</th>') || line.includes('<thead') || line.includes('</thead>') || line.includes('<tbody') || line.includes('</tbody>');
                                
                                if (isTableLine) {
                                    html += line;
                                    // If this is a table closing tag and next line is not a table line, add <br>
                                    if (line.includes('</table>') && i < processedLines.length - 1) {
                                        const nextLine = processedLines[i + 1];
                                        const nextIsTableLine = nextLine.includes('<table') || nextLine.includes('</table>') || nextLine.includes('<tr') || nextLine.includes('<td') || nextLine.includes('<th') || nextLine.includes('</tr>') || nextLine.includes('</td>') || nextLine.includes('</th>') || nextLine.includes('<thead') || nextLine.includes('</thead>') || nextLine.includes('<tbody') || nextLine.includes('</tbody>');
                                        if (!nextIsTableLine) {
                                            html += '<br>';
                                        }
                                    }
                                } else {
                                    html += line + (i < processedLines.length - 1 ? '<br>' : '');
                                }
                            }
                            
                            receiptDiv.innerHTML = html;
                        }
                        // Delay print to ensure preview renders first
                        setTimeout(function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 100);
                        }, 100);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function showCompleteOrderConfirmation() {
    if (cart.length === 0) {
        const completeOrderBtn = document.getElementById('completeOrderBtn');
        if (completeOrderBtn) {
            showButtonMessage(completeOrderBtn, 'Cart is empty!');
        }
        return;
    }

    const completeOrderBtn = document.getElementById('completeOrderBtn');
    if (!completeOrderBtn) return;

    // Get the button's computed style to match dimensions
    const btnStyle = window.getComputedStyle(completeOrderBtn);
    const buttonContainer = completeOrderBtn.parentElement;

    // Create a container div to hold both buttons side by side, matching the original button's dimensions
    const buttonsWrapper = document.createElement('div');
    // Match the button's grid column positioning and dimensions
    buttonsWrapper.style.cssText = `display: flex; gap: 4px; align-items: center; justify-content: center; padding: ${btnStyle.padding}; min-height: ${btnStyle.minHeight || '50px'}; border-radius: ${btnStyle.borderRadius}; box-shadow: ${btnStyle.boxShadow}; width: 100%;`;

    // Create tick and cross buttons - make them fit within the button space
    const tickButton = document.createElement('button');
    tickButton.className = 'action-btn';
    tickButton.style.cssText = 'background: #4caf50; font-family: "Poppins", "Inter", sans-serif; letter-spacing: 0.1px; flex: 1; height: 100%; min-height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; cursor: pointer; color: white; font-size: 18px; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);';
    tickButton.innerHTML = '✓';

    const crossButton = document.createElement('button');
    crossButton.className = 'action-btn';
    crossButton.style.cssText = 'background: #f44336; font-family: "Poppins", "Inter", sans-serif; letter-spacing: 0.1px; flex: 1; height: 100%; min-height: 40px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 8px; cursor: pointer; color: white; font-size: 18px; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 2px 4px rgba(244, 67, 54, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);';
    crossButton.innerHTML = '✕';

    // Add buttons to wrapper
    buttonsWrapper.appendChild(tickButton);
    buttonsWrapper.appendChild(crossButton);

    // Function to restore the Complete Order button
    const restoreCompleteButton = () => {
        const container = buttonsWrapper.parentElement;
        if (container && container.contains(buttonsWrapper)) {
            const newCompleteBtn = document.createElement('button');
            newCompleteBtn.id = 'completeOrderBtn';
            newCompleteBtn.className = 'action-btn complete-order-btn';
            newCompleteBtn.textContent = 'Complete Order';
            newCompleteBtn.onclick = () => showCompleteOrderConfirmation();
            container.replaceChild(newCompleteBtn, buttonsWrapper);
        }
    };

    tickButton.onclick = () => {
        restoreCompleteButton();
        completeOrder(true);
    };

    crossButton.onclick = () => {
        restoreCompleteButton();
    };

    // Replace Complete Order button with the buttons wrapper
    completeOrderBtn.replaceWith(buttonsWrapper);
}

function completeOrder(skipConfirmation = false) {
    if (cart.length === 0) {
        const completeOrderBtn = document.getElementById('completeOrderBtn');
        if (completeOrderBtn) {
            showButtonMessage(completeOrderBtn, 'Cart is empty!');
        }
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    // Calculate GST and Service Charges
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SALES_TAX_RATE;
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SERVICE_CHARGE_RATE;
    const total = discountedSubtotal + tax + serviceCharges;

    // Ask to complete order (only if not skipping confirmation)
    if (!skipConfirmation && !confirm('Complete this order?\n\nThe order will be saved to sales.')) {
        return;
    }

    // Save to sales
    const sales = Storage.get('sales') || [];
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;
    // Get selected waiter from dropdown
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    const newSale = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        discount: {
            type: currentDiscount.type,
            value: currentDiscount.value,
            amount: discountAmount
        },
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        date: new Date().toISOString()
    };

    sales.push(newSale);
    Storage.set('sales', sales);

    // Update stock quantities based on sale items
    updateStockFromSale(newSale.items);

    // Clear cart after saving order
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();

    // Reset waiter and table selection
    resetWaiterSelection();
    resetTableSelection();

    // Refresh sales if on sales tab
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }
}

function editHoldOrder(orderId) {
    // Require password before editing
    openActionPasswordModal(() => {
        const holdOrders = Storage.get('holdOrders');
        const order = holdOrders.find(o => o.id === orderId);

        if (!order) {
            alert('Order not found!');
            return;
        }

        // Load order items into cart
        cart = order.items.map(item => ({ ...item })); // Create a copy
        originalHoldOrderItems = order.items.map(item => ({ ...item })); // Store ORIGINAL for comparison
        editingHoldOrderId = orderId;

        editHoldOrderInternal(orderId, order);
    }, 'login');
}

function editHoldOrderInternal(orderId, order) {
    // Restore discount (if any)
    if (order.discount && order.discount.type) {
        currentDiscount = { type: order.discount.type, value: Number(order.discount.value || 0) };
    } else {
        currentDiscount = { type: null, value: 0 };
    }

    // Set payment method
    selectedPaymentMethod = order.paymentMethod || 'cash';

    // Switch to POS tab (edit page) first
    switchToTab('pos');

    // Use setTimeout to ensure tab switch completes before updating UI elements
    setTimeout(() => {
        // Update UI to show editing state
        const orderHeaderTitle = document.getElementById('orderHeaderTitle');
        const editingOrderInfo = document.getElementById('editingOrderInfo');
        const editingOrderId = document.getElementById('editingOrderId');
        const holdOrderBtn = document.getElementById('holdOrderBtn');
        const saveChangesBtn = document.getElementById('saveChangesBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const kotBtn = document.getElementById('kotBtn');
        const kotOrderBtn = document.getElementById('kotOrderBtn');
        const orderBtn = document.getElementById('orderBtn');
        const holdListBtn = document.getElementById('holdListBtn');
        const cashOrderBtn = document.getElementById('cashOrderBtn');
        const kotsBtn = document.getElementById('kotsBtn'); // New button to hide during edit

        if (orderHeaderTitle) orderHeaderTitle.textContent = 'Editing Order';
        if (editingOrderInfo) editingOrderInfo.style.display = 'block';
        if (editingOrderId) editingOrderId.textContent = order.orderId;
        if (holdOrderBtn) holdOrderBtn.style.display = 'none';
        if (holdListBtn) holdListBtn.style.display = 'none'; // Hide Hold Orders List button in edit mode
        if (cashOrderBtn) cashOrderBtn.style.display = 'none'; // Hide Cash Order button in edit mode
        if (saveChangesBtn) saveChangesBtn.style.display = 'block';
        if (cancelEditBtn) cancelEditBtn.style.display = 'block';
        if (kotBtn) kotBtn.style.display = 'none';
        if (kotOrderBtn) kotOrderBtn.style.display = 'none';
        if (orderBtn) orderBtn.style.display = 'none';
        if (kotsBtn) kotsBtn.style.display = 'none'; // Hide KOTS button in edit mode

        // Set payment method (after tab switch)
        selectPaymentMethod(selectedPaymentMethod);

        // Set waiter dropdown value if order has a waiter
        if (order.waiter) {
            loadWaitersDropdown(() => {
                const waiterSelect = document.getElementById('selectedWaiter');
                if (waiterSelect && order.waiter) {
                    // Try to find the option that matches the order's waiter
                    const waiterName = order.waiter.trim();
                    const options = waiterSelect.options;
                    let found = false;

                    for (let i = 0; i < options.length; i++) {
                        if (options[i].value === waiterName) {
                            waiterSelect.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }

                    // If not found in options, try setting value directly (in case waiter was deleted)
                    if (!found && waiterName) {
                        waiterSelect.value = waiterName;
                    }
                }
            });
        } else {
            // Load dropdown and reset to default
            loadWaitersDropdown();
        }

        // Set table dropdown value if order has a table
        if (order.tableNo) {
            setSelectedTableValue(order.tableNo, `Table ${order.tableNo}`);
        } else {
            setSelectedTableValue('', '');
        }
        loadTablesDropdown();

        // Set customer name if order has one
        const customerNameInput = document.getElementById('customerNameInput');
        if (customerNameInput && order.customerName) {
            customerNameInput.value = order.customerName;
        } else if (customerNameInput) {
            customerNameInput.value = '';
        }

        // Update cart display after switching (to ensure it shows the loaded order)
        updateCart();
        loadMenuItems();
    }, 100);
}

function saveHoldOrderChanges() {
    if (cart.length === 0) {
        const saveChangesBtn = document.getElementById('saveChangesBtn');
        if (saveChangesBtn) {
            showButtonMessage(saveChangesBtn, 'Cart is empty! Cannot save empty order.');
        }
        return;
    }

    if (!editingHoldOrderId) {
        alert('No order being edited!');
        return;
    }

    const holdOrders = Storage.get('holdOrders');
    const orderIndex = holdOrders.findIndex(o => o.id === editingHoldOrderId);

    if (orderIndex === -1) {
        alert('Order not found!');
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    // Calculate GST and Service Charges
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SALES_TAX_RATE;
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SERVICE_CHARGE_RATE;
    const total = discountedSubtotal + tax + serviceCharges;

    // Get selected waiter from dropdown
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    // Update the order
    holdOrders[orderIndex].items = cart.map(item => ({ ...item })); // Create a copy
    holdOrders[orderIndex].subtotal = subtotal;
    if (currentDiscount.type) {
        holdOrders[orderIndex].discount = { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount };
    } else {
        delete holdOrders[orderIndex].discount;
    }
    holdOrders[orderIndex].tax = tax;
    holdOrders[orderIndex].serviceCharges = serviceCharges;
    holdOrders[orderIndex].total = total;
    holdOrders[orderIndex].paymentMethod = selectedPaymentMethod;
    holdOrders[orderIndex].waiter = selectedWaiter || null;
    holdOrders[orderIndex].tableNo = selectedTableNo || null;
    holdOrders[orderIndex].customerName = getCustomerName() || null;
    holdOrders[orderIndex].updatedAt = new Date().toISOString();

    // Identify newly added items or increased quantities for the Kitchen
    const newItemsForKOT = [];
    cart.forEach(currentItem => {
        const originalItem = originalHoldOrderItems.find(o => o.id === currentItem.id);
        if (!originalItem) {
            // Completely new item
            newItemsForKOT.push({ ...currentItem });
        } else if (currentItem.quantity > originalItem.quantity) {
            // Increased quantity - print KOT for the additional amount
            newItemsForKOT.push({
                ...currentItem,
                quantity: currentItem.quantity - originalItem.quantity
            });
        }
    });

    Storage.set('holdOrders', holdOrders);

    // Print separate KOTs for NEW items ONLY
    if (newItemsForKOT.length > 0) {
        const displayOrderNumber = holdOrders[orderIndex].orderNumber.toString().padStart(7, '0');
        const now = new Date();
        const customerName = getCustomerName() || holdOrders[orderIndex].customerName;
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);
        const receiveTime = calculateReceiveTime(timeStr, now);
        const paymentMethod = selectedPaymentMethod;

        newItemsForKOT.forEach((item, index) => {
            const singleItemTable = formatKOTItems([item]);
            const kotHTML = `
                <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
                    <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>
                    <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
                    <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Customer: ${customerName ? escapeHtml(customerName) : '-'}</div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(paymentMethod)}</div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${dateStr} ${timeStr}</div>
                    ${receiveTime ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime}</div>` : ''}
                    ${selectedWaiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(selectedWaiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
                    <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                        <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                        <div style="width: 100%; display: block;">
                            ${singleItemTable}
                        </div>
                    </div>
                    <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                        <div style="font-size: 12px; font-weight: 700;">======================</div>
                    </div>
                </div>
            `;

            setTimeout(() => {
                printKOTWindow(kotHTML, displayOrderNumber);
            }, index * 1200);
        });
    }

    // Reset editing state
    cancelEditHoldOrder();

    // Switch back to Hold Orders tab
    switchToTab('holdOrders');

    // Refresh hold orders
    loadHoldOrders();
}

function cancelEditHoldOrder() {
    const wasEditing = editingHoldOrderId !== null;
    editingHoldOrderId = null;
    cart = [];
    originalHoldOrderItems = []; // Clear original items when cancelling/finishing edit
    menuItemQuantities = {};

    // Reset UI
    const orderHeaderTitle = document.getElementById('orderHeaderTitle');
    if (orderHeaderTitle) {
        orderHeaderTitle.textContent = `Order Details (${cart.length})`;
    }
    document.getElementById('editingOrderInfo').style.display = 'none';
    const holdOrderBtn = document.getElementById('holdOrderBtn');
    const holdListBtn = document.getElementById('holdListBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const kotBtn = document.getElementById('kotBtn');
    const kotOrderBtn = document.getElementById('kotOrderBtn');
    const orderBtn = document.getElementById('orderBtn');
    const cashOrderBtn = document.getElementById('cashOrderBtn');
    const kotsBtn = document.getElementById('kotsBtn');

    if (holdOrderBtn) holdOrderBtn.style.display = 'block';
    if (holdListBtn) holdListBtn.style.display = 'block'; // Show Hold Orders List button when not editing
    if (cashOrderBtn) cashOrderBtn.style.display = 'block'; // Show Cash Order button when not editing
    if (saveChangesBtn) saveChangesBtn.style.display = 'none';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    if (kotBtn) kotBtn.style.display = 'block';
    if (kotOrderBtn) kotOrderBtn.style.display = 'block';
    if (orderBtn) orderBtn.style.display = 'block';
    if (kotsBtn) kotsBtn.style.display = 'block';

    // Update cart display
    updateCart();
    loadMenuItems();

    // Switch back to Hold Orders tab if we were editing
    if (wasEditing) {
        const currentTab = document.querySelector('.tab-content.active')?.id;
        if (currentTab === 'pos') {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-tab="holdOrders"]')?.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('holdOrders')?.classList.add('active');

            // Hide order section
            const orderSectionWrapper = document.getElementById('orderSectionWrapper');
            const mainContent = document.querySelector('.main-content');
            if (orderSectionWrapper) orderSectionWrapper.classList.remove('show');
            if (mainContent) mainContent.classList.remove('has-order-section');

            // Refresh hold orders
            loadHoldOrders();
        }
    }
}

function deleteHoldOrder(orderId, buttonElement) {
    // Require password before deletion
    openActionPasswordModal(() => {
        // Re-find the button element after password verification
        let btnElement = buttonElement;
        if (!btnElement || !btnElement.parentElement || !document.contains(buttonElement)) {
            // Try to find the button in the DOM by looking for the hold order
            const holdOrderCards = document.querySelectorAll('.hold-order-card, [data-order-id]');
            for (let card of holdOrderCards) {
                const orderIdAttr = card.getAttribute('data-order-id') || card.querySelector('[data-order-id]')?.getAttribute('data-order-id');
                if (orderIdAttr === orderId) {
                    const deleteBtn = card.querySelector('button[onclick*="deleteHoldOrder"], .btn-delete');
                    if (deleteBtn) {
                        btnElement = deleteBtn;
                        break;
                    }
                }
            }
            // Also try finding by onclick attribute
            if (!btnElement || !document.contains(btnElement)) {
                const allDeleteBtns = document.querySelectorAll('button[onclick*="deleteHoldOrder"]');
                for (let btn of allDeleteBtns) {
                    const onclickAttr = btn.getAttribute('onclick') || '';
                    if (onclickAttr.includes(`"${orderId}"`) || onclickAttr.includes(`'${orderId}'`) || onclickAttr.includes(`(${orderId},`)) {
                        btnElement = btn;
                        break;
                    }
                }
            }
        }

        if (btnElement && btnElement.parentElement && document.contains(btnElement)) {
            showDeleteConfirmation(btnElement, deleteHoldOrderConfirmed, orderId);
        } else {
            // If button not found, directly delete (skip confirmation)
            deleteHoldOrderConfirmed(orderId);
        }
    });
}

function deleteHoldOrderConfirmed(orderId) {
    const holdOrders = Storage.get('holdOrders');
    const filtered = holdOrders.filter(o => o.id !== orderId);
    Storage.set('holdOrders', filtered);
    loadHoldOrders();

    // If deleting the order being edited, cancel edit
    if (editingHoldOrderId === orderId) {
        cancelEditHoldOrder();
    }
}

function printReceipt() {
    if (cart.length === 0) {
        const printReceiptBtn = document.getElementById('printReceiptBtn');
        if (printReceiptBtn) {
            showButtonMessage(printReceiptBtn, 'Cart is empty!');
        }
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SALES_TAX_RATE;
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : discountedSubtotal * SERVICE_CHARGE_RATE;
    const total = discountedSubtotal + tax + serviceCharges;

    // Skip confirmation - directly complete and print
    // Save to sales
    const sales = Storage.get('sales');
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;

    // Get selected waiter and table details
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    const newSale = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        ...(currentDiscount.type ? {
            discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
        } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        date: new Date().toISOString()
    };

    sales.push(newSale);
    Storage.set('sales', sales);

    // Update stock quantities based on sale items
    updateStockFromSale(newSale.items);

    const displayOrderNumber = orderNumber.toString().padStart(7, '0');

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    if (selectedTableNo) {
        receipt += `Table No: ${selectedTableNo}\n`;
    }
    const now = new Date();
    receipt += `${t('Date')}: ${formatDate(now)} ${formatTime(now)}\n`;
    const receiveTimeReceipt2 = calculateReceiveTime(formatTime(now), now);
    receipt += `Order Receive Time: ${receiveTimeReceipt2}\n`;
    receipt += `${t('Location')}: ${formatLocation(selectedPaymentMethod)}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(cart);

    receipt += formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total);
    receipt += `======================\n`;

    // Create KOT (Kitchen Order Ticket) - same details, items without prices
    const kotItemsTable2 = formatKOTItems(cart);
    const receiveTime2 = calculateReceiveTime(formatTime(now), now);
    const kotHTML2 = `
        <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
            <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>

            <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${formatDate(now)} ${formatTime(now)}</div>
            ${receiveTime2 ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime2}</div>` : ''}
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(selectedPaymentMethod)}</div>
            ${selectedTableNo ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Table No: ${escapeHtml(selectedTableNo)}</div>` : ''}
            ${selectedWaiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(selectedWaiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
            <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                <div style="width: 100%; display: block;">
                    ${kotItemsTable2}
                </div>
            </div>
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                <div style="font-size: 12px; font-weight: 700;">======================</div>
            </div>
        </div>
    `;

    // Clear cart after saving order
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();
    resetWaiterSelection();
    resetTableSelection();
    resetCustomerName();

    // Refresh sales if on sales tab
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }

    // Print customer receipt (separate window)
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
        receiptWindow.document.write(`
            <html>
                <head>
                    <title>Customer Receipt</title>
                    <style>
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            padding: 10px;
                            font-size: 13px;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            align-items: center;
                            min-height: auto;
                            margin: 0;
                        }
                    .receipt-logo {
                        max-width: 120px;
                        max-height: 120px;
                        width: auto;
                        height: auto;
                        margin: 0 auto 2px auto;
                        display: block;
                        object-fit: contain;
                    }
                    pre {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        text-align: center;
                        margin: 0;
                        padding: 0;
                        font-weight: bold;
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    }
                    .order-id-line {
                        font-size: 16px;
                        font-weight: 700;
                    }
                    .restaurant-heading {
                        font-size: 20px;
                        font-weight: 900;
                    }
                    @media print {
                        body {
                            padding: 5mm 0;
                            min-height: auto;
                            display: block;
                        }
                        .receipt-logo {
                            max-width: 100px;
                            max-height: 100px;
                            margin: 0 auto 2px auto;
                        }
                            pre {
                                page-break-inside: avoid;
                                break-inside: avoid;
                                padding: 0;
                            }
                            .order-id-line {
                                font-size: 16px !important;
                                font-weight: 700 !important;
                            }
                            @page {
                                size: auto;
                                margin: 5mm;
                            }
                        }
                    </style>
                </head>
                <body>

                    <pre id="receiptContent">${receipt}</pre>
                    <script>
                        window.onload = function() {
                            const pre = document.getElementById('receiptContent');
                            if (pre) {
                                const text = pre.textContent;
                                const lines = text.split('\\n');
                                
                                // Make restaurant heading bigger
                                const restaurantIndex = lines.findIndex(line => line.trim() === 'ABC Restaurant' || line.includes('ABC Restaurant'));
                                if (restaurantIndex !== -1) {
                                    lines[restaurantIndex] = '<span class="restaurant-heading">' + lines[restaurantIndex] + '</span>';
                                }
                                
                                // Make Order ID line bolder and bigger
                                const orderIdIndex = lines.findIndex(line => line.includes('Order No.:') || line.includes('Order No.') || line.includes('Order ID:') || line.includes('Order ID') || line.includes('Order:'));
                                if (orderIdIndex !== -1) {
                                    lines[orderIdIndex] = '<span class="order-id-line">' + lines[orderIdIndex] + '</span>';
                                }
                                
                                pre.innerHTML = lines.join('\\n');
                            }
                            // Delay print to ensure preview renders first
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 100);
                            }, 100);
                        }
                    </script>
                </body>
            </html>
        `);
        receiptWindow.document.close();
    }

    // Print KOT (separate window, after a short delay)
    setTimeout(() => {
        const kotWindow = window.open('', '_blank');
        if (kotWindow) {
            kotWindow.document.write(`
                <html>
                    <head>
                        <title>KOT</title>
                        <style>
                            body {
                                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                                padding: 10px;
                                margin: 0;
                                display: flex;
                                flex-direction: column;
                                justify-content: flex-start;
                                align-items: center;
                                min-height: auto;
                            }
                            .receipt-logo {
                                max-width: 120px;
                                max-height: 120px;
                                width: auto;
                                height: auto;
                                margin-bottom: 10px;
                                display: block;
                                object-fit: contain;
                            }
                            @media print {
                                body {
                                    padding: 5mm 0;
                                    min-height: auto;
                                    display: block;
                                }
                                .receipt-logo {
                                    max-width: 100px;
                                    max-height: 100px;
                                    margin-bottom: 8px;
                                }
                                @page {
                                    size: auto;
                                    margin: 5mm;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        <div id="kotContent">${kotHTML2}</div>
                        <script>
                            window.onload = function() {
                                // Delay print to ensure preview renders first
                                setTimeout(function() {
                                    window.print();
                                    setTimeout(function() {
                                        window.close();
                                    }, 100);
                                }, 100);
                            }
                        </script>
                    </body>
                </html>
            `);
            kotWindow.document.close();
        }
    }, 500);
}

// Helper function to save order and generate receipt/KOT content
function saveOrderAndGenerateContent() {
    if (cart.length === 0) {
        return null;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    // Exclude tax for Parcel/Delivery orders
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
    const total = discountedSubtotal + tax + serviceCharges;

    // Get selected waiter and table details
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    // Save to sales
    const sales = Storage.get('sales');
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;
    const newSale = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        ...(currentDiscount.type ? {
            discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
        } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        customerName: getCustomerName() || null,
        date: new Date().toISOString()
    };

    sales.push(newSale);
    Storage.set('sales', sales);

    // Update stock quantities based on sale items
    updateStockFromSale(newSale.items);

    const displayOrderNumber = orderNumber.toString().padStart(7, '0');
    const now = new Date();

    // Get customer name from input
    const customerName = getCustomerName();

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${customerName || '-'}\n`;
    if (selectedTableNo) {
        receipt += `Table No: ${selectedTableNo}\n`;
    }
    receipt += `${t('Location')}: ${formatLocation(selectedPaymentMethod)}\n`;
    receipt += `${t('Date')}: ${formatDate(now)} ${formatTime(now)}\n`;
    const receiveTimeReceipt3 = calculateReceiveTime(formatTime(now), now);
    receipt += `Order Receive Time: ${receiveTimeReceipt3}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(cart);

    receipt += formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Create KOT (Kitchen Order Ticket) - same details, items without prices
    const kotItemsTable3 = formatKOTItems(cart);
    const receiveTime3 = calculateReceiveTime(formatTime(now), now);
    const kotHTML3 = `
        <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
            <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>

            <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Customer: ${customerName ? escapeHtml(customerName) : '-'}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(selectedPaymentMethod)}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${formatDate(now)} ${formatTime(now)}</div>
            ${receiveTime3 ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime3}</div>` : ''}
            ${selectedTableNo ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Table No: ${escapeHtml(selectedTableNo)}</div>` : ''}
            ${selectedWaiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(selectedWaiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
            <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                <div style="width: 100%; display: block;">
                    ${kotItemsTable3}
                </div>
            </div>
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                <div style="font-size: 12px; font-weight: 700;">======================</div>
            </div>
        </div>
    `;
    const kot = kotHTML3; // Keep variable name for compatibility

    // Clear cart after saving order
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();

    // Reset waiter selection
    resetWaiterSelection();
    resetTableSelection();

    // Reset customer name
    resetCustomerName();

    // Refresh sales if on sales tab
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }

    return {
        receipt,
        kot,
        displayOrderNumber
    };
}

// Helper function to print KOT
function printKOTWindow(kotHTML, displayOrderNumber) {
    const kotWindow = window.open('', '_blank');
    if (kotWindow) {
        kotWindow.document.open();
        kotWindow.document.write(`
            <html>
                <head>
                    <title>KOT - ${displayOrderNumber}</title>
                    <style>
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            padding: 5px;
                            margin: 0;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            align-items: center;
                            min-height: auto;
                        }
                        @media print {
                            body {
                                padding: 2mm 0;
                                min-height: auto;
                                display: block;
                            }
                            @page {
                                size: auto;
                                margin: 2mm;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div id="kotContent">${kotHTML}</div>
                    <script>
                        // More robust print trigger
                        function startPrint() {
                            // Ensure content is visible and rendered
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 150);
                            }, 350); // Increased delay for rendering
                        }
                        
                        // Try both onload and immediate if already loaded
                        if (document.readyState === 'complete') {
                            startPrint();
                        } else {
                            window.onload = startPrint;
                        }
                    </script>
                </body>
            </html>
        `);
        kotWindow.document.close();
    }
}

// Helper function to print Order receipt
function printOrderWindow(receipt, displayOrderNumber) {
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow) {
        const safeReceipt = escapeHtml(receipt);
        receiptWindow.document.write(`
            <html>
                <head>
                    <title>Customer Receipt - ${displayOrderNumber}</title>
                    <style>
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            padding: 10px;
                            font-size: 13px;
                            display: flex;
                            flex-direction: column;
                            justify-content: flex-start;
                            align-items: center;
                            min-height: auto;
                            margin: 0;
                        }
                        .receipt-logo {
                            max-width: 120px;
                            max-height: 120px;
                            width: auto;
                            height: auto;
                            margin: 0 auto 0 auto;
                            display: block;
                            object-fit: contain;
                        }
                        pre {
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            text-align: center;
                            margin: 0;
                            padding: 0;
                            font-weight: bold;
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        }
                        .order-id-line {
                            font-size: 16px;
                            font-weight: 700;
                        }
                        .restaurant-heading {
                            font-size: 20px;
                            font-weight: 900;
                        }
                        @media print {
                            body {
                                padding: 5mm 0;
                                min-height: auto;
                                display: block;
                            }
                            .receipt-logo {
                                max-width: 100px;
                                max-height: 100px;
                                margin: 0 auto 0 auto;
                            }
                            pre {
                                page-break-inside: avoid;
                                break-inside: avoid;
                                padding: 0;
                            }
                            .order-id-line {
                                font-size: 16px !important;
                                font-weight: 700 !important;
                            }
                            @page {
                                size: auto;
                                margin: 5mm;
                            }
                        }
                    </style>
                </head>
                <body>

                    <pre id="receiptContent">${safeReceipt}</pre>
                    <script>
                        window.onload = function() {
                            const pre = document.getElementById('receiptContent');
                            if (pre) {
                                const text = pre.textContent;
                                const lines = text.split('\\n');
                                
                                // Make restaurant heading bigger
                                const restaurantIndex = lines.findIndex(line => line.trim() === 'ABC Restaurant' || line.includes('ABC Restaurant'));
                                if (restaurantIndex !== -1) {
                                    lines[restaurantIndex] = '<span class="restaurant-heading">' + lines[restaurantIndex] + '</span>';
                                }
                                
                                // Make Order ID line bolder and bigger
                                const orderIdIndex = lines.findIndex(line => line.includes('Order No.:') || line.includes('Order No.') || line.includes('Order ID:') || line.includes('Order ID') || line.includes('Order:'));
                                if (orderIdIndex !== -1) {
                                    lines[orderIdIndex] = '<span class="order-id-line">' + lines[orderIdIndex] + '</span>';
                                }
                                
                                pre.innerHTML = lines.join('\\n');
                            }
                            // Delay print to ensure preview renders first
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 100);
                            }, 100);
                        }
                    </script>
                </body>
            </html>
        `);
        receiptWindow.document.close();
    }
}

// Print only KOT
// Function to hold order and generate content (for KOT and KOT+Order buttons)
function holdOrderAndGenerateContent() {
    if (cart.length === 0) {
        return null;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    // Exclude tax for Parcel/Delivery orders
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
    const total = discountedSubtotal + tax + serviceCharges;

    // Save to holdOrders instead of sales
    const holdOrders = Storage.get('holdOrders') || [];
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;
    const now = new Date();

    // Get selected waiter and table details
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    const heldOrder = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        date: formatDate(now),
        time: formatTime(now),
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        ...(currentDiscount.type ? {
            discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
        } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        customerName: getCustomerName() || null,
        status: 'pending',
        createdAt: now.toISOString()
    };

    holdOrders.push(heldOrder);
    Storage.set('holdOrders', holdOrders);

    const displayOrderNumber = orderNumber.toString().padStart(7, '0');

    // Get customer name
    const customerName = getCustomerName();

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${customerName || '-'}\n`;
    if (selectedTableNo) {
        receipt += `Table No: ${selectedTableNo}\n`;
    }
    receipt += `${t('Date')}: ${heldOrder.date} ${heldOrder.time}\n`;
    const receiveTimeReceipt4 = calculateReceiveTime(heldOrder.time, heldOrder.date);
    receipt += `Order Receive Time: ${receiveTimeReceipt4}\n`;
    receipt += `${t('Location')}: ${formatLocation(selectedPaymentMethod)}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(cart);

    receipt += formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Create KOT (Kitchen Order Ticket) - same details, items without prices
    const kotItemsTable4 = formatKOTItems(cart);
    const receiveTime4 = calculateReceiveTime(heldOrder.time, heldOrder.date);
    const kotHTML4 = `
        <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
            <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>

            <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
            <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Customer: ${customerName ? escapeHtml(customerName) : '-'}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(selectedPaymentMethod)}</div>
            <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${heldOrder.date} ${heldOrder.time}</div>
            ${receiveTime4 ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime4}</div>` : ''}
            ${selectedTableNo ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Table No: ${escapeHtml(selectedTableNo)}</div>` : ''}
            ${heldOrder.waiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(heldOrder.waiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
            <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                <div style="width: 100%; display: block;">
                    ${kotItemsTable4}
                </div>
            </div>
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                <div style="font-size: 12px; font-weight: 700;">======================</div>
            </div>
        </div>
    `;
    const kot = kotHTML4; // Keep variable name for compatibility

    // Clear cart after holding order
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();

    // Reset waiter selection
    resetWaiterSelection();
    resetTableSelection();

    // Reset customer name
    resetCustomerName();

    // Refresh hold orders if on hold orders tab
    if (document.getElementById('holdOrders')?.classList.contains('active')) {
        loadHoldOrders();
    }

    return {
        receipt,
        kot,
        displayOrderNumber
    };
}

window.printKOT = function () {
    if (cart.length === 0) {
        const kotBtn = document.getElementById('kotBtn');
        if (kotBtn) {
            showButtonMessage(kotBtn, 'Cart is empty!');
        }
        return;
    }

    const content = holdOrderAndGenerateContent();
    if (content) {
        printKOTWindow(content.kot, content.displayOrderNumber);
    }
};

window.printSeparateKOTs = function () {
    if (cart.length === 0) {
        const kotsBtn = document.getElementById('kotsBtn');
        if (kotsBtn) {
            showButtonMessage(kotsBtn, 'Cart is empty!');
        }
        return;
    }

    // Capture cart and necessary info before it's cleared by holdOrderAndGenerateContent
    const cartCopy = cart.map(item => ({ ...item }));
    const customerName = getCustomerName();
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';
    
    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';
    
    const paymentMethod = selectedPaymentMethod;

    // Save order to hold orders (this clears the real cart and provides order number)
    const content = holdOrderAndGenerateContent();

    if (content) {
        const displayOrderNumber = content.displayOrderNumber;
        const now = new Date();
        const dateStr = formatDate(now);
        const timeStr = formatTime(now);
        const receiveTime = calculateReceiveTime(timeStr, now);

        // Print separate KOT for each item in the original cart
        cartCopy.forEach((item, index) => {
            // For each item, create a one-item KOT HTML
            const singleItemTable = formatKOTItems([item]);
            const kotHTML = `
                <div style="text-align: center; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 100%; line-height: 1.2;">
                    <div style="font-size: 20px; font-weight: 900; margin-bottom: 2px;">ABC Restaurant</div>
                    <div style="font-size: 16px; font-weight: 900; margin: 3px 0;">====== KOT ======</div>
                    <div style="font-size: 14px; margin-bottom: 2px;"><strong>${t('Order No.')} ${displayOrderNumber}</strong></div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Customer: ${customerName ? escapeHtml(customerName) : '-'}</div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Location')}: ${formatLocation(paymentMethod)}</div>
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">${t('Date')}: ${dateStr} ${timeStr}</div>
                    ${receiveTime ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Order Receive Time: ${receiveTime}</div>` : ''}
                    ${selectedTableNo ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Table No: ${escapeHtml(selectedTableNo)}</div>` : ''}
                    ${selectedWaiter ? `<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;">Waiter: ${escapeHtml(selectedWaiter)}</div>` : '<div style="font-size: 12px; font-weight: 700; margin-bottom: 5px;"></div>'}
                    <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px; width: 100%;">
                        <div style="font-size: 12px; font-weight: 700; margin-bottom: 3px; text-align: center;">${t('ITEMS:')}</div>
                        <div style="width: 100%; display: block;">
                            ${singleItemTable}
                        </div>
                    </div>
                    <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 4px;">
                        <div style="font-size: 12px; font-weight: 700;">======================</div>
                    </div>
                </div>
            `;

            // Print with a larger delay between each window to prevent overlapping/blank issues
            setTimeout(() => {
                printKOTWindow(kotHTML, displayOrderNumber);
            }, index * 1200); // Increased to 1.2s for stability
        });
    }
};

// Print only Order receipt
window.printOrder = function () {
    if (cart.length === 0) {
        const orderBtn = document.getElementById('orderBtn');
        if (orderBtn) {
            showButtonMessage(orderBtn, 'Cart is empty!');
        }
        return;
    }

    const content = saveOrderAndGenerateContent();
    if (content) {
        printOrderWindow(content.receipt, content.displayOrderNumber);
    }
};

// Process Cash Order - Save sale, print receipt, clear cart (no hold order, no KOT)
window.processCashOrder = function () {
    if (cart.length === 0) {
        const cashOrderBtn = document.getElementById('cashOrderBtn');
        if (cashOrderBtn) {
            showButtonMessage(cashOrderBtn, 'Cart is empty!');
        }
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    // Exclude tax for Parcel/Delivery orders
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
    const total = discountedSubtotal + tax + serviceCharges;

    // Get selected waiter and table details
    const selectedWaiterElement = document.getElementById('selectedWaiter');
    const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

    const selectedTableElement = document.getElementById('selectedTable');
    const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

    // Save to sales
    const sales = Storage.get('sales');
    const orderNumber = getNextOrderNumber();
    const orderId = `ORD-${orderNumber}`;
    const newSale = {
        id: orderId,
        orderId: orderId,
        orderNumber: orderNumber,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
        })),
        subtotal: subtotal,
        ...(currentDiscount.type ? {
            discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
        } : {}),
        tax: tax,
        serviceCharges: serviceCharges,
        total: total,
        paymentMethod: selectedPaymentMethod,
        waiter: selectedWaiter || null,
        tableNo: selectedTableNo || null,
        customerName: getCustomerName() || null,
        date: new Date().toISOString()
    };

    sales.push(newSale);
    Storage.set('sales', sales);

    // Update stock quantities based on sale items
    updateStockFromSale(newSale.items);

    const displayOrderNumber = orderNumber.toString().padStart(7, '0');
    const now = new Date();

    // Get customer name
    const customerName = getCustomerName();

    // Create receipt content
    let receipt = `ABC Restaurant\n`;
    receipt += `Contact: 0319-9922922\n`;
    receipt += `Wah Model Town, Wah Cantt\n`;
    receipt += `======================\n`;
    receipt += `${t('Order No.')} ${displayOrderNumber}\n`;
    receipt += `Customer: ${customerName || '-'}\n`;
    if (selectedTableNo) {
        receipt += `Table No: ${selectedTableNo}\n`;
    }
    receipt += `${t('Location')}: ${formatLocation(selectedPaymentMethod)}\n`;
    receipt += `${t('Date')}: ${formatDate(now)} ${formatTime(now)}\n`;
    const receiveTimeReceipt = calculateReceiveTime(formatTime(now), now);
    receipt += `Order Receive Time: ${receiveTimeReceipt}\n`;
    receipt += `--------------------------\n`;
    receipt += `${t('ITEMS:')}\n`;
    receipt += formatReceiptItems(cart);

    receipt += formatReceiptSummary(subtotal, discountAmount, tax, serviceCharges, total);
    receipt += `======================\n`;
    receipt += `Bank Al Habib: Muhammad Ihsan\n`;
    receipt += `04210981000927019\n`;
    receipt += `======================\n`;
    receipt += `Thank You!\n`;
    receipt += `\n\n\n`;

    // Print customer receipt
    printOrderWindow(receipt, displayOrderNumber);

    // Clear cart after saving order
    cart = [];
    menuItemQuantities = {};
    updateCart();
    loadMenuItems();

    // Reset waiter and table selection
    resetWaiterSelection();
    resetTableSelection();

    // Reset customer name
    resetCustomerName();

    // Refresh sales if on sales tab
    if (document.getElementById('sales')?.classList.contains('active')) {
        loadSales();
    }
};

// Print both KOT and Order
window.printKOTAndOrder = function () {
    if (cart.length === 0) {
        const kotOrderBtn = document.getElementById('kotOrderBtn');
        if (kotOrderBtn) {
            showButtonMessage(kotOrderBtn, 'Cart is empty!');
        }
        return;
    }

    const content = holdOrderAndGenerateContent();
    if (content) {
        // Print KOT first as requested
        printKOTWindow(content.kot, content.displayOrderNumber);

        // Print Order receipt after a short delay
        setTimeout(() => {
            printOrderWindow(content.receipt, content.displayOrderNumber);
        }, 500);
    }
};

function resetAllData() {
    // Show confirmation dialog
    if (!confirm('⚠️ WARNING: This will delete ALL data!\n\nThis includes:\n- All menu items and categories\n- All sales records\n- All employees and payouts\n- All expenses\n- All tables\n- All hold orders\n- All favorites\n\nThis action cannot be undone!\n\nAre you absolutely sure you want to reset all data?')) {
        return;
    }

    // Show second confirmation
    if (!confirm('This is your last chance to cancel.\n\nClick OK to permanently delete ALL data.')) {
        return;
    }

    // Clear all localStorage keys
    const keysToClear = [
        'menuCategories',
        'menuItems',
        'menuItemOrder',
        'favorites',
        'holdOrders',
        'sales',
        'employees',
        'expenseCategories',
        'expenses',
        'tables',
        'dishes' // Legacy key
    ];

    keysToClear.forEach(key => {
        localStorage.removeItem(key);
    });

    // Clear cart and reset state
    cart = [];
    menuItemQuantities = {};
    editingHoldOrderId = null;
    selectedPaymentMethod = 'cash';

    // Reload all data
    loadCategories();
    loadMenuItems();
    updateCart();
    loadMenuCategories();
    loadMenuItemsList();
    updateCategoryDropdowns();
    loadSales();
    loadEmployees();
    loadExpenses();
    loadTables();
    loadHoldOrders();
    loadDashboard();

    // Initialize charts when dashboard tab is active
    if (document.getElementById('dashboard')) {
        initCharts();
    }

    // Initialize payment method button styling
    setTimeout(() => {
        selectPaymentMethod('cash');
    }, 100);

    alert('All data has been reset successfully!');
}

function processPayment() {
    if (cart.length === 0) {
        // Find the payment button - it might be in different places
        const paymentBtn = document.querySelector('.place-order-btn') || document.querySelector('button[onclick*="processPayment"]');
        if (paymentBtn) {
            showButtonMessage(paymentBtn, 'Cart is empty!');
        }
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Calculate discount
    let discountAmount = 0;
    if (currentDiscount.type === 'fixed') {
        discountAmount = Math.min(currentDiscount.value, subtotal);
    } else if (currentDiscount.type === 'percentage') {
        discountAmount = (subtotal * currentDiscount.value) / 100;
    }

    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    // Exclude tax for Parcel/Delivery orders
    const tax = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SALES_TAX_RATE);
    const serviceCharges = (selectedPaymentMethod === 'delivery' || selectedPaymentMethod === 'parcel') ? 0 : (discountedSubtotal * SERVICE_CHARGE_RATE);
    const total = discountedSubtotal + tax + serviceCharges;

    if (confirm(`Place order for Rs.${formatNumber(total)}?`)) {
        // Record sales as a single order
        const sales = Storage.get('sales');
        const orderNumber = getNextOrderNumber();
        const orderId = `ORD-${orderNumber}`;
        // Get selected waiter from dropdown
        const selectedWaiterElement = document.getElementById('selectedWaiter');
        const selectedWaiter = selectedWaiterElement ? selectedWaiterElement.value.trim() : '';

        const selectedTableElement = document.getElementById('selectedTable');
        const selectedTableNo = selectedTableElement ? selectedTableElement.value.trim() : '';

        const newSale = {
            id: orderId,
            orderId: orderId,
            orderNumber: orderNumber,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            })),
            subtotal: subtotal,
            ...(currentDiscount.type ? {
                discount: { type: currentDiscount.type, value: currentDiscount.value, amount: discountAmount }
            } : {}),
            tax: tax,
            serviceCharges: serviceCharges,
            total: total,
            paymentMethod: selectedPaymentMethod,
            waiter: selectedWaiter || null,
            tableNo: selectedTableNo || null,
            date: new Date().toISOString()
        };

        sales.push(newSale);
        Storage.set('sales', sales);

        // Update stock quantities based on sale items
        updateStockFromSale(newSale.items);

        // Clear cart
        cart = [];
        menuItemQuantities = {};
        updateCart();
        loadMenuItems();

        // Reset waiter and table selection
        resetWaiterSelection();
        resetTableSelection();


        // Refresh sales if on sales tab
        if (document.getElementById('sales')?.classList.contains('active')) {
            loadSales();
        }
    }
}

// Initialize menu structure
function initializeMenuStructure() {
    let menuCategories = Storage.get('menuCategories');
    let menuItems = Storage.get('menuItems');

    // Migrate old dishes data if exists
    const oldDishes = Storage.get('dishes');
    if (oldDishes && oldDishes.length > 0 && menuCategories.length === 0) {
        // Create categories from old dishes
        const categoryMap = {};
        oldDishes.forEach(dish => {
            if (!categoryMap[dish.category]) {
                const newCategory = {
                    id: Date.now() + Math.random(),
                    name: dish.category.charAt(0).toUpperCase() + dish.category.slice(1)
                };
                menuCategories.push(newCategory);
                categoryMap[dish.category] = newCategory.id;
            }
        });

        // Convert dishes to menu items
        oldDishes.forEach(dish => {
            const categoryId = categoryMap[dish.category];
            menuItems.push({
                id: dish.id,
                categoryId: categoryId,
                name: dish.name,
                price: dish.price
            });
        });

        Storage.set('menuCategories', menuCategories);
        Storage.set('menuItems', menuItems);
    }

    // Initialize with default Karahi category if no categories exist
    if (menuCategories.length === 0) {
        const karahiCategory = {
            id: Date.now(),
            name: 'Karahi'
        };
        menuCategories.push(karahiCategory);

        const defaultItems = [
            { name: 'Chicken Half Karahi', price: 800 },
            { name: 'Chicken Full Karahi', price: 1500 },
            { name: 'Beef Half Karahi', price: 900 },
            { name: 'Beef Full Karahi', price: 1700 },
            { name: 'Mutton Half Karahi', price: 1000 },
            { name: 'Mutton Full Karahi', price: 1900 }
        ];

        defaultItems.forEach((item, index) => {
            menuItems.push({
                id: Date.now() + index + 1,
                categoryId: karahiCategory.id,
                name: item.name,
                price: item.price
            });
        });

        Storage.set('menuCategories', menuCategories);
        Storage.set('menuItems', menuItems);
    }
}

// Update order date display
function updateOrderDate() {
    const orderDateEl = document.getElementById('orderDate');
    if (orderDateEl) {
        const now = new Date();
        orderDateEl.textContent = `${formatDate(now)} ${formatTime(now)}`;
    }
}

// Update current time in order header (POS right panel)
function updateOrderCurrentTime() {
    const el = document.getElementById('orderCurrentTime');
    if (!el) return;
    const now = new Date();
    el.textContent = formatTimeShortWithSeconds(now);
}

// -------------------------
// Global "click outside modal" close (works for all popups)
// -------------------------
function getTopmostOpenModal() {
    const modals = Array.from(document.querySelectorAll('.modal'));
    const open = modals.filter(m => {
        try {
            return window.getComputedStyle(m).display !== 'none';
        } catch (_) {
            return false;
        }
    });
    if (open.length === 0) return null;
    return open[open.length - 1];
}

function closeModalById(modalId) {
    if (!modalId) return;
    switch (modalId) {
        case 'saleModal':
            if (typeof window.closeSaleModal === 'function') return window.closeSaleModal();
            break;
        case 'payoutsListModal':
            if (typeof window.closePayoutsListModal === 'function') return window.closePayoutsListModal();
            break;
        case 'addEmployeeModal':
            if (typeof window.closeAddEmployeeModal === 'function') return window.closeAddEmployeeModal();
            break;
        case 'addPayoutModal':
            if (typeof window.closeAddPayoutModal === 'function') return window.closeAddPayoutModal();
            break;
        case 'attendanceModal':
            if (typeof window.closeAttendanceModal === 'function') return window.closeAttendanceModal();
            break;
        case 'addExpenseModal':
            if (typeof window.closeAddExpenseModal === 'function') return window.closeAddExpenseModal();
            break;
        case 'expenseCategoryModal':
            if (typeof window.closeExpenseCategoryModal === 'function') return window.closeExpenseCategoryModal();
            break;
        case 'addMenuItemModal':
            if (typeof window.closeAddMenuItemModal === 'function') return window.closeAddMenuItemModal();
            break;
        case 'addCategoryModal':
            if (typeof window.closeAddCategoryModal === 'function') return window.closeAddCategoryModal();
            break;
        case 'addTableModal':
            if (typeof window.closeAddTableModal === 'function') return window.closeAddTableModal();
            break;
        case 'bookTableModal':
            if (typeof window.closeBookTableModal === 'function') return window.closeBookTableModal();
            break;
        case 'discountModal': {
            const el = document.getElementById('discountModal');
            if (el) el.style.display = 'none';
            return;
        }
        default:
            break;
    }
    // Fallback: just hide the modal
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
}

function handleGlobalModalOutsideClick(e) {
    const modal = getTopmostOpenModal();
    if (!modal) return;

    // If click is inside modal-content, don't close
    const content = modal.querySelector('.modal-content');
    if (content && content.contains(e.target)) return;

    closeModalById(modal.id);
}

function closeAllOpenModals() {
    const modals = Array.from(document.querySelectorAll('.modal'));
    const open = modals.filter(m => {
        try {
            return window.getComputedStyle(m).display !== 'none';
        } catch (_) {
            return false;
        }
    });
    // Close from topmost down
    for (let i = open.length - 1; i >= 0; i--) {
        closeModalById(open[i].id);
    }
}

function handleBookTableSubmit(e) {
    // Guard: prevent full page reload/navigation on submit
    e.preventDefault();
    e.stopImmediatePropagation();

    if (!currentBookingTableId) return;

    const tables = Storage.get('tables') || [];
    const table = tables.find(t => String(t.id) === String(currentBookingTableId));
    if (!table) return;

    const customerNameEl = document.getElementById('customerName');
    const customerContactEl = document.getElementById('customerContact');
    const bookingDateEl = document.getElementById('bookingDate');
    const bookingTimeEl = document.getElementById('bookingTime');
    const customerName = (customerNameEl?.value || '').trim();
    const customerContact = (customerContactEl?.value || '').trim();
    const bookingDate = bookingDateEl?.value || '';
    const bookingTime = bookingTimeEl?.value || '';

    if (!customerName) {
        alert('Please enter a customer name');
        return;
    }
    if (!customerContact) {
        alert('Please enter a contact number');
        return;
    }
    if (!bookingDate) {
        alert('Please select a booking date');
        return;
    }
    if (!bookingTime) {
        alert('Please select a booking time');
        return;
    }

    table.status = 'booked';
    table.customerName = customerName;
    table.customerContact = customerContact;
    table.bookingDate = bookingDate;
    table.bookingTime = bookingTime;
    Storage.set('tables', tables);
    loadTables();
    closeBookTableModal();
}

function handleTableFormSubmit(e) {
    // Guard: prevent full page reload/navigation on submit
    e.preventDefault();
    e.stopImmediatePropagation();

    const tables = Storage.get('tables') || [];
    const number = parseInt(document.getElementById('tableNumber')?.value, 10);
    const seats = parseInt(document.getElementById('tableSeats')?.value, 10);

    if (!number || number < 1) {
        alert('Please enter a valid table number');
        return;
    }
    if (!seats || seats < 1) {
        alert('Please enter a valid number of seats');
        return;
    }

    // Check if table number already exists (when adding new)
    if (editingTableId === null) {
        const existingTable = tables.find(t => t.number === number);
        if (existingTable) {
            alert('A table with this number already exists');
            return;
        }
    } else {
        // When editing, check if number conflicts with other tables
        const existingTable = tables.find(t => t.number === number && String(t.id) !== String(editingTableId));
        if (existingTable) {
            alert('A table with this number already exists');
            return;
        }
    }

    if (editingTableId !== null) {
        // Edit existing table
        const index = tables.findIndex(t => String(t.id) === String(editingTableId));
        if (index !== -1) {
            tables[index].number = number;
            tables[index].seats = seats;
        }
    } else {
        // Add new table
        const newTable = {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            number,
            seats,
            status: 'available',
            customerName: null,
            customerContact: null
        };
        tables.push(newTable);
    }

    Storage.set('tables', tables);
    loadTables();
    closeAddTableModal();
    editingTableId = null; // Reset editing state
}

// Install global handlers immediately (and only once)
if (!window.__outsideModalCloseInstalled) {
    window.__outsideModalCloseInstalled = true;
    // Inside app: click/tap outside modal content closes it
    document.addEventListener('pointerdown', handleGlobalModalOutsideClick, true);
    // Prevent refresh on Book Table submit (Electron can reload if submit isn't handled)
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (form && form.id === 'bookTableForm') {
            handleBookTableSubmit(e);
        }
        if (form && form.id === 'tableForm') {
            handleTableFormSubmit(e);
        }
    }, true);
    // Outside app: when window loses focus, close any open modal.
    // BUT: ignore blur/hidden events triggered by native alert/confirm dialogs.
    window.addEventListener('blur', () => {
        if (window.__inNativeDialog) return;
        closeAllOpenModals();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !window.__inNativeDialog) closeAllOpenModals();
    });
}

// Make functions globally available
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateQuantity = updateQuantity;
window.showDiscountModal = showDiscountModal;
window.applyDiscount = applyDiscount;
window.clearDiscount = clearDiscount;
window.setCartQuantityDirect = setCartQuantityDirect;
window.updateMenuQuantity = updateMenuQuantity;
window.clearCart = clearCart;
window.processPayment = processPayment;
window.selectPaymentMethod = selectPaymentMethod;
window.printReceipt = printReceipt;

// Open favourites management tab
window.toggleManageFavourites = () => {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

    // Remove active state from all nav items
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    // Show favourites tab
    const favouritesTab = document.getElementById('favourites');
    if (favouritesTab) {
        favouritesTab.classList.add('active');
        loadFavouritesForManagement();

        // Scroll to top
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.scrollTop = 0;
        }
    }
};

// Load favourites items for position management
function loadFavouritesForManagement() {
    const favouritesGrid = document.getElementById('favouritesGrid');
    if (!favouritesGrid) return;

    const favorites = Storage.get('favorites') || [];
    const menuItems = Storage.get('menuItems') || [];

    if (favorites.length === 0) {
        favouritesGrid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><p>No favourites added yet.</p><p style="font-size: 14px; margin-top: 10px;">Add items to favourites from the POS page to manage their positions here.</p></div>';
        return;
    }

    // Get favourite items
    const favouriteItems = favorites.map(id => menuItems.find(item => item.id === id)).filter(item => item !== undefined);

    // Get saved order for favourites
    let itemOrder = Storage.get('menuItemOrder') || {};
    const savedOrder = itemOrder['favorites'] || [];

    // Sort items according to saved order
    const sortedItems = [...favouriteItems].sort((a, b) => {
        const indexA = savedOrder.indexOf(a.id);
        const indexB = savedOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    favouritesGrid.innerHTML = '';

    const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2RkZCIgc3Ryb2tlLXdpZHRoPSIyIi8+PHBhdGggZD0iTTcwIDEwMEwxMDAgNzBMMTMwIDEwMEwxMDAgMTMwWiIgZmlsbD0iI2RkZCIvPjwvc3ZnPg==';

    sortedItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'favourite-item-card';
        card.dataset.itemId = item.id;
        card.draggable = true;
        card.style.cssText = 'background: #ffffff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 6px; cursor: move; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';

        const imageSrc = item.image || placeholderImage;

        card.innerHTML = `
            <div style="width: 100%; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 6px; margin-bottom: 4px; background: #f5f5f5;">
                <img src="${imageSrc}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${placeholderImage}'">
            </div>
            <div style="font-weight: 600; color: #2c3e50; font-size: 12px; margin-bottom: 2px; line-height: 1.2;">${item.name}</div>
            <div style="font-weight: 700; color: #2980b9; font-size: 14px;">Rs.${formatNumber(item.price)}</div>
        `;

        // Add drag event listeners
        card.addEventListener('dragstart', handleFavouriteDragStart);
        card.addEventListener('dragend', handleFavouriteDragEnd);
        card.addEventListener('dragover', handleFavouriteDragOver);
        card.addEventListener('dragenter', handleFavouriteDragEnter);
        card.addEventListener('dragleave', handleFavouriteDragLeave);
        card.addEventListener('drop', handleFavouriteDrop);

        card.addEventListener('mouseenter', function () {
            this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            this.style.borderColor = '#4a90e2';
        });

        card.addEventListener('mouseleave', function () {
            if (!this.classList.contains('dragging')) {
                this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                this.style.borderColor = '#e0e0e0';
            }
        });

        favouritesGrid.appendChild(card);
    });
}

let draggedFavouriteElement = null;

function handleFavouriteDragStart(e) {
    draggedFavouriteElement = this;
    this.classList.add('dragging');
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleFavouriteDragEnd(e) {
    this.classList.remove('dragging');
    this.style.opacity = '1';
    document.querySelectorAll('.favourite-item-card').forEach(card => {
        card.classList.remove('drag-over');
        card.style.borderColor = '#e0e0e0';
    });
}

function handleFavouriteDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleFavouriteDragEnter(e) {
    if (this !== draggedFavouriteElement) {
        this.classList.add('drag-over');
        this.style.borderColor = '#4a90e2';
        this.style.borderStyle = 'dashed';
    }
}

function handleFavouriteDragLeave(e) {
    this.classList.remove('drag-over');
    this.style.borderColor = '#e0e0e0';
    this.style.borderStyle = 'solid';
}

function handleFavouriteDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (e.preventDefault) {
        e.preventDefault();
    }

    if (draggedFavouriteElement !== this) {
        const favouritesGrid = document.getElementById('favouritesGrid');
        const allCards = Array.from(favouritesGrid.querySelectorAll('.favourite-item-card'));
        const draggedIndex = allCards.indexOf(draggedFavouriteElement);
        const targetIndex = allCards.indexOf(this);

        if (draggedIndex < targetIndex) {
            favouritesGrid.insertBefore(draggedFavouriteElement, this.nextSibling);
        } else {
            favouritesGrid.insertBefore(draggedFavouriteElement, this);
        }
    }

    this.classList.remove('drag-over');
    this.style.borderColor = '#e0e0e0';
    this.style.borderStyle = 'solid';
    return false;
}

// Save favourites order
window.saveFavouritesOrder = () => {
    const favouritesGrid = document.getElementById('favouritesGrid');
    if (!favouritesGrid) return;

    const cards = Array.from(favouritesGrid.querySelectorAll('.favourite-item-card'));
    const itemIds = cards.map(card => parseInt(card.dataset.itemId));

    if (itemIds.length === 0) {
        alert('No favourites to save!');
        return;
    }

    // Get current order
    let itemOrder = Storage.get('menuItemOrder');
    if (!itemOrder || typeof itemOrder !== 'object') {
        itemOrder = {};
    }

    // Save the exact order as it appears in the DOM
    itemOrder['favorites'] = itemIds;
    Storage.set('menuItemOrder', itemOrder);

    // Also update POS if it's active
    if (document.getElementById('pos')?.classList.contains('active')) {
        if (selectedCategory === 'favorites' && window.loadMenuItems) {
            window.loadMenuItems();
        }
    }

    // Return to menu tab
    switchToTab('menu');
};
window.completeOrder = completeOrder;
window.resetAllData = resetAllData;
window.holdOrder = holdOrder;
window.editHoldOrder = editHoldOrder;
window.saveHoldOrderChanges = saveHoldOrderChanges;
window.cancelEditHoldOrder = cancelEditHoldOrder;
window.markOrderSuccessful = markOrderSuccessful;
window.printReceiptForOrder = printReceiptForOrder;
window.deleteHoldOrder = deleteHoldOrder;
window.closeHoldOrderSuccessModal = closeHoldOrderSuccessModal;
window.undoHoldOrder = undoHoldOrder;
window.clearAllSales = clearAllSales;
// Table functions are already assigned to window above

// Setup menu items search functionality
function setupMenuItemsSearch() {
    const menuItemSearchInput = document.getElementById('menuItemSearch');
    if (menuItemSearchInput && !menuItemSearchInput.hasAttribute('data-search-listener')) {
        // Mark as having listener to avoid duplicates
        menuItemSearchInput.setAttribute('data-search-listener', 'true');

        // Add real-time search on input change with debouncing
        const debouncedLoadMenuItemsList = debounce(() => {
            loadMenuItemsList();
        }, 300);

        menuItemSearchInput.addEventListener('input', () => {
            debouncedLoadMenuItemsList();
        });
    }
}

// Setup sales filters functionality
function setupSalesFilters() {
    const salesDateFilter = document.getElementById('salesDateFilter');
    const salesMonthFilter = document.getElementById('salesMonthFilter');
    const salesPaymentFilter = document.getElementById('salesPaymentFilter');
    const salesSortFilter = document.getElementById('salesSortFilter');
    const salesCustomDateRange = document.getElementById('salesCustomDateRange');
    const salesMonthFilterContainer = document.getElementById('salesMonthFilterContainer');
    const salesStartDate = document.getElementById('salesStartDate');
    const salesEndDate = document.getElementById('salesEndDate');

    if (salesDateFilter && !salesDateFilter.hasAttribute('data-filter-listener')) {
        salesDateFilter.setAttribute('data-filter-listener', 'true');
        salesDateFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            if (salesCustomDateRange) {
                salesCustomDateRange.style.display = value === 'custom' ? 'flex' : 'none';
            }
            if (salesMonthFilterContainer) {
                salesMonthFilterContainer.style.display = value === 'specific-month' ? 'flex' : 'none';
            }
            loadSales();
        });
    }
    if (salesMonthFilter && !salesMonthFilter.hasAttribute('data-filter-listener')) {
        salesMonthFilter.setAttribute('data-filter-listener', 'true');
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        salesMonthFilter.value = yearMonth;

        // Initialize other month filters in the sales tab
        const itemsSalesMonthFilter = document.getElementById('itemsSalesMonthFilter');
        if (itemsSalesMonthFilter) itemsSalesMonthFilter.value = yearMonth;
        const taxHistoryMonthFilter = document.getElementById('taxHistoryMonthFilter');
        if (taxHistoryMonthFilter) taxHistoryMonthFilter.value = yearMonth;

        salesMonthFilter.addEventListener('change', () => {
            loadSales();
        });
    }
    if (salesStartDate && !salesStartDate.hasAttribute('data-filter-listener')) {
        salesStartDate.setAttribute('data-filter-listener', 'true');
        salesStartDate.addEventListener('change', () => {
            loadSales();
        });
    }
    if (salesEndDate && !salesEndDate.hasAttribute('data-filter-listener')) {
        salesEndDate.setAttribute('data-filter-listener', 'true');
        salesEndDate.addEventListener('change', () => {
            loadSales();
        });
    }
    if (salesPaymentFilter && !salesPaymentFilter.hasAttribute('data-filter-listener')) {
        salesPaymentFilter.setAttribute('data-filter-listener', 'true');
        salesPaymentFilter.addEventListener('change', () => {
            loadSales();
        });
    }
    if (salesSortFilter && !salesSortFilter.hasAttribute('data-filter-listener')) {
        salesSortFilter.setAttribute('data-filter-listener', 'true');
        salesSortFilter.addEventListener('change', () => {
            loadSales();
        });
    }
}

// Setup expenses filters functionality
function setupExpensesFilters() {
    const expenseDateFilter = document.getElementById('expenseDateFilter');
    const expenseMonthFilter = document.getElementById('expenseMonthFilter');
    const expenseCategoryFilter = document.getElementById('expenseCategoryFilter');
    const expenseSearch = document.getElementById('expenseSearch');
    const expenseSortFilter = document.getElementById('expenseSortFilter');
    const expenseStartDate = document.getElementById('expenseStartDate');
    const expenseEndDate = document.getElementById('expenseEndDate');
    const expenseCustomDateRange = document.getElementById('expenseCustomDateRange');
    const expenseMonthFilterContainer = document.getElementById('expenseMonthFilterContainer');

    if (expenseDateFilter && !expenseDateFilter.hasAttribute('data-filter-listener')) {
        expenseDateFilter.setAttribute('data-filter-listener', 'true');
        expenseDateFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            if (expenseCustomDateRange) {
                expenseCustomDateRange.style.display = value === 'custom' ? 'flex' : 'none';
            }
            if (expenseMonthFilterContainer) {
                expenseMonthFilterContainer.style.display = value === 'specific-month' ? 'flex' : 'none';
            }
            loadExpenses();
        });
    }
    if (expenseMonthFilter && !expenseMonthFilter.hasAttribute('data-filter-listener')) {
        expenseMonthFilter.setAttribute('data-filter-listener', 'true');
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        expenseMonthFilter.value = yearMonth;
        expenseMonthFilter.addEventListener('change', () => {
            loadExpenses();
        });
    }
    if (expenseStartDate && !expenseStartDate.hasAttribute('data-filter-listener')) {
        expenseStartDate.setAttribute('data-filter-listener', 'true');
        expenseStartDate.addEventListener('change', () => loadExpenses());
    }
    if (expenseEndDate && !expenseEndDate.hasAttribute('data-filter-listener')) {
        expenseEndDate.setAttribute('data-filter-listener', 'true');
        expenseEndDate.addEventListener('change', () => loadExpenses());
    }
    if (expenseCategoryFilter && !expenseCategoryFilter.hasAttribute('data-filter-listener')) {
        expenseCategoryFilter.setAttribute('data-filter-listener', 'true');
        expenseCategoryFilter.addEventListener('change', () => loadExpenses());
    }
    if (expenseSortFilter && !expenseSortFilter.hasAttribute('data-filter-listener')) {
        expenseSortFilter.setAttribute('data-filter-listener', 'true');
        expenseSortFilter.addEventListener('change', () => loadExpenses());
    }
}

// Setup employees filters functionality
function setupEmployeeFilters() {
    const employeeSearch = document.getElementById('employeeSearch');
    const employeeDateFilter = document.getElementById('employeeDateFilter');
    const employeeMonthFilter = document.getElementById('employeeMonthFilter');

    if (employeeSearch && !employeeSearch.hasAttribute('data-filter-listener')) {
        employeeSearch.setAttribute('data-filter-listener', 'true');
        employeeSearch.addEventListener('input', () => loadEmployees());
    }
    if (employeeDateFilter && !employeeDateFilter.hasAttribute('data-filter-listener')) {
        employeeDateFilter.setAttribute('data-filter-listener', 'true');
        employeeDateFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            const monthRange = document.getElementById('employeeMonthFilterContainer');
            if (monthRange) {
                monthRange.style.display = value === 'specific-month' ? 'flex' : 'none';
            }
            loadEmployees();
        });
    }
    if (employeeMonthFilter && !employeeMonthFilter.hasAttribute('data-filter-listener')) {
        employeeMonthFilter.setAttribute('data-filter-listener', 'true');
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        employeeMonthFilter.value = yearMonth;
        employeeMonthFilter.addEventListener('change', () => loadEmployees());
    }
}

// Reset filter helper functions
window.resetSalesFilter = () => {
    const filterSelect = document.getElementById('salesDateFilter');
    if (filterSelect) {
        filterSelect.value = 'today';
        filterSelect.dispatchEvent(new Event('change'));
    }
};

window.resetExpenseFilter = () => {
    const filterSelect = document.getElementById('expenseDateFilter');
    if (filterSelect) {
        filterSelect.value = 'today';
        filterSelect.dispatchEvent(new Event('change'));
    }
};

window.resetEmployeeFilter = () => {
    const filterSelect = document.getElementById('employeeDateFilter');
    if (filterSelect) {
        filterSelect.value = 'all';
        filterSelect.dispatchEvent(new Event('change'));
    }
};

window.resetTaxHistoryFilter = () => {
    const filterSelect = document.getElementById('taxHistoryFilter');
    if (filterSelect) {
        filterSelect.value = 'today';
        filterSelect.dispatchEvent(new Event('change'));
    }
};

window.resetItemsSalesFilter = () => {
    const filterSelect = document.getElementById('itemsSalesDateFilter');
    if (filterSelect) {
        filterSelect.value = 'today';
        filterSelect.dispatchEvent(new Event('change'));
    }
};

// Initialize
// Set logo path for Electron (works in both dev and production)
function setLogoPath() {
    const logoImage = document.getElementById('logoImage');
    if (logoImage) {
        // Use relative path - works in both development and when packaged
        // The assets folder should be included in the build
        logoImage.src = 'assets/logo.jpg';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setLogoPath();
    // Initialize menu structure
    initializeMenuStructure();

    // Seed 50 dummy tables data if tables list is less than 40
    let existingTables = Storage.get('tables') || [];
    if (existingTables.length < 40) {
        let tables = [];
        for (let i = 1; i <= 50; i++) {
            const seats = Math.floor(Math.random() * 2) + 4; // 4 or 5 seats
            tables.push({
                id: `TABLE-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                number: String(i),
                seats: seats,
                status: 'available'
            });
        }
        Storage.set('tables', tables);
    }

    // Set today's date as default for sales
    const saleDateInput = document.getElementById('saleDate');
    if (saleDateInput) {
        saleDateInput.value = new Date().toISOString().split('T')[0];
    }

    // Show order section for POS (default tab is 'pos')
    const orderSectionWrapper = document.getElementById('orderSectionWrapper');
    const mainContent = document.querySelector('.main-content');
    const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'pos';

    if (activeTab === 'pos') {
        if (orderSectionWrapper) orderSectionWrapper.classList.add('show');
        if (mainContent) mainContent.classList.add('has-order-section');
        // Load waiters dropdown for POS
        loadWaitersDropdown();
        loadTablesDropdown();
    } else {
        if (orderSectionWrapper) orderSectionWrapper.classList.remove('show');
        if (mainContent) mainContent.classList.remove('has-order-section');
    }

    // Set up custom Table dropdown event listeners
    const tableSearchInput = document.getElementById('tableSearchInput');
    const tableDropdownContent = document.getElementById('tableDropdownContent');
    const tableSearchFilter = document.getElementById('tableSearchFilter');
    
    if (tableSearchInput && tableDropdownContent) {
        tableSearchInput.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = tableDropdownContent.style.display === 'block';
            if (isVisible) {
                tableDropdownContent.style.display = 'none';
            } else {
                loadTablesDropdown(() => {
                    tableDropdownContent.style.display = 'block';
                    if (tableSearchFilter) {
                        tableSearchFilter.value = '';
                        tableSearchFilter.focus();
                        // Reset visibility of list items
                        const items = document.querySelectorAll('#tableListItems div');
                        items.forEach(item => { item.style.display = 'block'; });
                    }
                });
            }
        });
    }

    if (tableSearchFilter) {
        tableSearchFilter.addEventListener('input', () => {
            const query = tableSearchFilter.value.toLowerCase().trim();
            const items = document.querySelectorAll('#tableListItems div');
            items.forEach(item => {
                const tableNo = item.getAttribute('data-table-no') || '';
                if (query === '' || (tableNo !== '' && tableNo.includes(query))) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Close table dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (tableDropdownContent && tableDropdownContent.style.display === 'block') {
            const container = document.getElementById('tableDropdownContainer');
            if (container && !container.contains(e.target)) {
                tableDropdownContent.style.display = 'none';
            }
        }
    });

    // Update order date
    updateOrderDate();
    setInterval(updateOrderDate, 60000); // Update every minute

    // Update current time in the order header
    updateOrderCurrentTime();
    setInterval(updateOrderCurrentTime, 1000); // Update every second

    // Load initial data
    loadCategories();
    loadMenuItems();
    updateCart();
    loadMenuCategories();
    loadMenuItemsList();
    updateCategoryDropdowns();
    loadSales();
    loadEmployees();
    loadExpenses();
    loadStock();
    handleTableTimeFilterTypeChange();

    // Setup search functionality for POS with debouncing
    const menuSearchInput = document.getElementById('menuSearch');
    if (menuSearchInput) {
        const debouncedLoadMenuItems = debounce(() => {
            loadMenuItems();
        }, 300);

        menuSearchInput.addEventListener('input', (e) => {
            window.searchQuery = e.target.value;
            searchQuery = e.target.value;
            debouncedLoadMenuItems();
        });
    }

    // Setup search functionality for Menu Items list - Real-time search
    setupMenuItemsSearch();

    // Close modal when clicking outside
    const modal = document.getElementById('saleModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSaleModal();
            }
        });
    }

    // Employee filters
    const employeeSearch = document.getElementById('employeeSearch');

    if (employeeSearch) {
        employeeSearch.addEventListener('input', loadEmployees);
    }

    // Expense filters
    const expenseCategoryFilter = document.getElementById('expenseCategoryFilter');
    const expenseDateFilter = document.getElementById('expenseDateFilter');
    const expenseStartDate = document.getElementById('expenseStartDate');
    const expenseEndDate = document.getElementById('expenseEndDate');
    const expenseSortFilter = document.getElementById('expenseSortFilter');
    const expenseCustomDateRange = document.getElementById('expenseCustomDateRange');

    if (expenseCategoryFilter) {
        expenseCategoryFilter.addEventListener('change', loadExpenses);
    }
    if (expenseDateFilter) {
        expenseDateFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            if (expenseCustomDateRange) {
                if (value === 'custom') {
                    expenseCustomDateRange.style.display = 'flex';
                } else {
                    expenseCustomDateRange.style.display = 'none';
                }
            }
            loadExpenses();
        });
    }
    if (expenseStartDate) {
        expenseStartDate.addEventListener('change', loadExpenses);
    }
    if (expenseEndDate) {
        expenseEndDate.addEventListener('change', loadExpenses);
    }
    if (expenseSortFilter) {
        expenseSortFilter.addEventListener('change', loadExpenses);
    }

    // Expense search functionality
    const expenseSearchInput = document.getElementById('expenseSearch');
    if (expenseSearchInput) {
        expenseSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchExpenses();
            }
        });
        expenseSearchInput.addEventListener('input', () => {
            loadExpenses();
        });
    }

    // Initialize expense categories
    initializeExpenseCategories();
    loadExpenseCategories();
    updateExpenseCategoryDropdown();

    // Close expense modal when clicking outside
    const expenseModal = document.getElementById('addExpenseModal');
    if (expenseModal) {
        expenseModal.addEventListener('click', (e) => {
            if (e.target === expenseModal) {
                closeAddExpenseModal();
            }
        });
    }

    // Close expense category modal when clicking outside
    const expenseCategoryModal = document.getElementById('expenseCategoryModal');
    if (expenseCategoryModal) {
        expenseCategoryModal.addEventListener('click', (e) => {
            if (e.target === expenseCategoryModal) {
                closeExpenseCategoryModal();
            }
        });
    }

    // Close add menu item modal when clicking outside
    const addMenuItemModal = document.getElementById('addMenuItemModal');
    if (addMenuItemModal) {
        addMenuItemModal.addEventListener('click', (e) => {
            if (e.target === addMenuItemModal) {
                closeAddMenuItemModal();
            }
        });
    }

    // Add event listeners to form fields to check "Add Next Item" button state
    const addMenuItemCategory = document.getElementById('addMenuItemCategory');
    const addMenuItemName = document.getElementById('addMenuItemName');
    const addMenuItemPrice = document.getElementById('addMenuItemPrice');

    if (addMenuItemCategory) {
        addMenuItemCategory.addEventListener('change', checkAddNextItemButton);
        addMenuItemCategory.addEventListener('input', checkAddNextItemButton);
    }
    if (addMenuItemName) {
        addMenuItemName.addEventListener('input', checkAddNextItemButton);
    }
    if (addMenuItemPrice) {
        addMenuItemPrice.addEventListener('input', checkAddNextItemButton);
    }

    // Close add category modal when clicking outside
    const addCategoryModal = document.getElementById('addCategoryModal');
    if (addCategoryModal) {
        addCategoryModal.addEventListener('click', (e) => {
            if (e.target === addCategoryModal) {
                closeAddCategoryModal();
            }
        });
    }

    // Close add table modal when clicking outside
    const addTableModal = document.getElementById('addTableModal');
    if (addTableModal) {
        addTableModal.addEventListener('click', (e) => {
            if (e.target === addTableModal) {
                closeAddTableModal();
            }
        });
    }

    // Close book table modal when clicking outside
    const bookTableModal = document.getElementById('bookTableModal');
    if (bookTableModal) {
        bookTableModal.addEventListener('click', (e) => {
            if (e.target === bookTableModal) {
                closeBookTableModal();
            }
        });
    }

    // Close add employee modal when clicking outside
    const addEmployeeModal = document.getElementById('addEmployeeModal');
    if (addEmployeeModal) {
        addEmployeeModal.addEventListener('click', (e) => {
            if (e.target === addEmployeeModal) {
                closeAddEmployeeModal();
            }
        });
    }

    // Close add payout modal when clicking outside
    const addPayoutModal = document.getElementById('addPayoutModal');
    if (addPayoutModal) {
        addPayoutModal.addEventListener('click', (e) => {
            if (e.target === addPayoutModal) {
                closeAddPayoutModal();
            }
        });
    }

    // Close attendance modal when clicking outside
    const attendanceModal = document.getElementById('attendanceModal');
    if (attendanceModal) {
        attendanceModal.addEventListener('click', (e) => {
            if (e.target === attendanceModal) {
                closeAttendanceModal();
            }
        });
    }

    // Close discount modal when clicking outside
    const discountModal = document.getElementById('discountModal');
    if (discountModal) {
        discountModal.addEventListener('click', (e) => {
            if (e.target === discountModal) {
                discountModal.style.display = 'none';
            }
        });
    }

    // Global handler is installed above (once). Keep DOMContentLoaded clean.

    // Table form handler
    const tableForm = document.getElementById('tableForm');
    if (tableForm) {
        tableForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const tables = Storage.get('tables') || [];
            const number = parseInt(document.getElementById('tableNumber').value);
            const seats = parseInt(document.getElementById('tableSeats').value);

            if (!number || number < 1) {
                alert('Please enter a valid table number');
                return;
            }

            if (!seats || seats < 1) {
                alert('Please enter a valid number of seats');
                return;
            }

            // Check if table number already exists (when adding new)
            if (editingTableId === null) {
                const existingTable = tables.find(t => t.number === number);
                if (existingTable) {
                    alert('A table with this number already exists');
                    return;
                }
            } else {
                // When editing, check if number conflicts with other tables
                const existingTable = tables.find(t => t.number === number && String(t.id) !== String(editingTableId));
                if (existingTable) {
                    alert('A table with this number already exists');
                    return;
                }
            }

            if (editingTableId !== null) {
                // Edit existing table
                const index = tables.findIndex(t => String(t.id) === String(editingTableId));
                if (index !== -1) {
                    tables[index].number = number;
                    tables[index].seats = seats;
                }
            } else {
                // Add new table
                const newTable = {
                    id: Date.now().toString(),
                    number: number,
                    seats: seats,
                    status: 'available',
                    customerName: null,
                    customerContact: null
                };
                tables.push(newTable);
            }

            Storage.set('tables', tables);
            loadTables();
            closeAddTableModal();
            editingTableId = null; // Reset editing state
        });
    } else {
        console.error('Table form not found');
    }

    // Book table form handler
    const bookTableForm = document.getElementById('bookTableForm');
    if (bookTableForm) {
        bookTableForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!currentBookingTableId) return;

            const tables = Storage.get('tables') || [];
            const table = tables.find(t => String(t.id) === String(currentBookingTableId));
            if (!table) return;

            const customerName = document.getElementById('customerName').value.trim();
            const customerContact = document.getElementById('customerContact').value.trim();
            const bookingDate = document.getElementById('bookingDate').value;
            const bookingTime = document.getElementById('bookingTime').value;
            if (!customerName) {
                alert('Please enter a customer name');
                return;
            }
            if (!customerContact) {
                alert('Please enter a contact number');
                return;
            }
            if (!bookingDate) {
                alert('Please select a booking date');
                return;
            }
            if (!bookingTime) {
                alert('Please select a booking time');
                return;
            }

            table.status = 'booked';
            table.customerName = customerName;
            table.customerContact = customerContact;
            table.bookingDate = bookingDate;
            table.bookingTime = bookingTime;
            Storage.set('tables', tables);
            loadTables();
            closeBookTableModal();
        });
    }

    // Sales filters - Auto-apply on change
    // Setup sales filters
    setupSalesFilters();

    // Items Sales filters
    const itemsSalesSortFilter = document.getElementById('itemsSalesSortFilter');

    if (itemsSalesSortFilter) {
        itemsSalesSortFilter.addEventListener('change', loadItemsSales);
    }

    // Items Sales search
    const itemsSalesSearch = document.getElementById('itemsSalesSearch');
    if (itemsSalesSearch) {
        itemsSalesSearch.addEventListener('input', loadItemsSales);
    }
});


// Reports Functions
function generateReportHTML(title, filterText, startDate, endDate, transactionList = null, dailyBreakdown = null, breakdownTitle = 'Daily Breakdown', breakdownLabel = 'Date') {
    const sales = Storage.get('sales') || [];
    const expenses = Storage.get('expenses') || [];

    // Group sales logic (handling legacy data)
    const orderMap = {};
    const ungroupedSales = [];

    sales.forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
            const orderId = sale.orderId || sale.id;
            orderMap[orderId] = sale;
        } else {
            ungroupedSales.push(sale);
        }
    });

    const groupedByTime = {};
    ungroupedSales.forEach(sale => {
        const saleDate = new Date(sale.date);
        const timeKey = Math.floor(saleDate.getTime() / 5000) * 5000;
        const groupKey = `${timeKey}-${(sale.paymentMethod || 'cash')}`;

        if (!groupedByTime[groupKey]) {
            groupedByTime[groupKey] = {
                id: `ORD-${timeKey}`,
                orderId: `ORD-${timeKey}`,
                date: sale.date,
                paymentMethod: sale.paymentMethod || 'cash',
                items: [],
                total: 0,
                subtotal: 0,
                tax: 0,
                discount: { amount: 0 }
            };
        }
        groupedByTime[groupKey].items.push(sale);
        groupedByTime[groupKey].total += (sale.total || 0);
        groupedByTime[groupKey].subtotal += (sale.total || 0);
    });

    Object.values(groupedByTime).forEach(order => {
        orderMap[order.orderId] = order;
    });

    let orders = Object.values(orderMap);

    // Filter by Date
    orders = orders.filter(order => {
        if (!order.date) return false;
        const d = new Date(order.date);
        return d >= startDate && d <= endDate;
    });

    // Calculate Metrics
    const transactions = orders.length;
    let cash = 0; // Subtotal
    let serviceCharges = 0;
    let discount = 0;
    let netSale = 0;

    const locationStats = {
        'Gents': { bills: 0, total: 0 },
        'Family': { bills: 0, total: 0 },
        'Parcel': { bills: 0, total: 0 }
    };

    orders.forEach(o => {
        const sub = parseFloat(o.subtotal) || 0;
        const tax = parseFloat(o.tax) || 0;
        const disc = o.discount ? (parseFloat(o.discount.amount) || 0) : 0;
        const tot = parseFloat(o.total) || 0;

        cash += sub;
        serviceCharges += tax;
        discount += disc;
        netSale += tot;

        // Location mapping
        let loc = 'Gents';
        const pm = (o.paymentMethod || 'cash').toLowerCase();
        if (pm === 'online' || pm === 'family') loc = 'Family';
        if (pm === 'delivery' || pm === 'parcel') loc = 'Parcel';

        if (locationStats[loc]) {
            locationStats[loc].bills++;
            locationStats[loc].total += tot;
        }
    });

    // Expenses
    const periodExpenses = expenses.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return d >= startDate && d <= endDate;
    });
    const cashOut = periodExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const cashInHand = netSale - cashOut;
    const averageSale = transactions > 0 ? (netSale / transactions) : 0;

    // Current Date Formatted
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    let html = `
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
                    font-size: 13px; 
                    width: 300px; /* Thermal printer width */
                    margin: 0 auto; 
                    padding: 10px;
                    color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .header { margin-bottom: 5px; }
                .header h1 { font-size: 18px; margin: 0; font-weight: 900; }
                .header p { margin: 2px 0; font-size: 12px; }
                .divider { border-bottom: 1px dashed black; margin: 5px 0; }
                .solid-divider { border-bottom: 1px solid black; margin: 5px 0; }
                .report-title { font-size: 16px; font-weight: bold; text-decoration: underline; margin: 5px 0; text-transform: uppercase;}
                .meta-info { font-size: 12px; margin-bottom: 5px; }
                
                .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                .summary-table td { padding: 2px 0; }
                .summary-table .label { text-align: left; }
                .summary-table .value { text-align: right; font-weight: bold; }
                
                .section-title { font-size: 14px; font-weight: bold; margin: 10px 0 5px 0; }
                
                .details-table { width: 100%; border-collapse: collapse; }
                .details-table th { text-align: left; border-bottom: 1px solid black; padding: 2px 0; font-size: 12px; }
                .details-table td { padding: 2px 0; font-size: 12px; }
                .details-table .totals-row td { border-top: 1px solid black; font-weight: bold; padding-top: 4px; }
                
                @media print {
                    body { width: 100%; margin: 0; padding: 0; }
                    .page-break { page-break-before: always; }
                }
            </style>
        </head>
        <body>
            <div class="header text-center">
                <h1>ABC Restaurant</h1>
                <p>Contact: 0319-9922922</p>
                <p>Wah Model Town, Wah Cantt</p>
            </div>
            
            <div class="divider"></div>
            
            <div class="text-center">
                <div class="report-title">SALES REPORT</div>
                <div class="meta-info">
                    Date: ${dateStr} ${timeStr}<br>
                    Filter: ${filterText}
                </div>
            </div>
            
            <div class="divider"></div>
            
            <table class="summary-table">
                <tr>
                    <td class="label">Transactions:</td>
                    <td class="value">${transactions}</td>
                </tr>
                <tr>
                    <td class="label">Cash:</td>
                    <td class="value">Rs.${formatNumber(cash)}</td>
                </tr>
                <tr>
                    <td class="label">Service Charges:</td>
                    <td class="value">Rs.${formatNumber(serviceCharges)}</td>
                </tr>
                <tr>
                    <td class="label">Discount:</td>
                    <td class="value">Rs.${formatNumber(discount)}</td>
                </tr>
                <tr>
                    <td class="label">Net Sale:</td>
                    <td class="value">Rs.${formatNumber(netSale)}</td>
                </tr>
                <tr>
                    <td class="label">Average Sale:</td>
                    <td class="value">Rs.${formatNumber(averageSale)}</td>
                </tr>
                <tr>
                    <td class="label">Expenses:</td>
                    <td class="value">Rs.${formatNumber(cashOut)}</td>
                </tr>
            </table>
            
            <div class="solid-divider"></div>
            
            <table class="summary-table">
                <tr>
                    <td class="label" style="font-size: 14px;">Cash In Hand:</td>
                    <td class="value" style="font-size: 14px;">Rs.${formatNumber(cashInHand)}</td>
                </tr>
            </table>
            
            <div class="divider"></div>
            
            <div class="section-title">Order Type Wise</div>
            <table class="details-table">
                <thead>
                    <tr>
                        <th style="width: 30%">Location</th>
                        <th style="width: 20%; text-align: center;">Bills</th>
                        <th style="width: 30%; text-align: right;">Total</th>
                        <th style="width: 20%; text-align: right;">Avg</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Gents</td>
                        <td class="text-center">${locationStats['Gents'].bills}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Gents'].total)}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Gents'].bills > 0 ? locationStats['Gents'].total / locationStats['Gents'].bills : 0)}</td>
                    </tr>
                    <tr>
                        <td>Family</td>
                        <td class="text-center">${locationStats['Family'].bills}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Family'].total)}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Family'].bills > 0 ? locationStats['Family'].total / locationStats['Family'].bills : 0)}</td>
                    </tr>
                    <tr>
                        <td>Parcel</td>
                        <td class="text-center">${locationStats['Parcel'].bills}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Parcel'].total)}</td>
                        <td class="text-right">Rs.${formatNumber(locationStats['Parcel'].bills > 0 ? locationStats['Parcel'].total / locationStats['Parcel'].bills : 0)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="divider"></div>
    `;

    // Append Detailed Section if provided
    if (transactionList && transactionList.length > 0) {
        html += `
            <div class="section-title">Details</div>
            <table class="details-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Order</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
        `;
        transactionList.forEach(item => {
            html += `
                <tr>
                    <td>${item.time}</td>
                    <td>${item.id}</td>
                    <td class="text-right">Rs.${formatNumber(item.total)}</td>
                </tr>
             `;
        });
        html += `
                </tbody>
            </table>
            <div class="divider"></div>
        `;
    } else if (dailyBreakdown && dailyBreakdown.length > 0) {
        html += `
            <div class="section-title">${breakdownTitle}</div>
            <table class="details-table">
                <thead>
                    <tr>
                        <th>${breakdownLabel}</th>
                        <th class="text-right">Sales</th>
                    </tr>
                </thead>
                <tbody>
        `;
        dailyBreakdown.forEach(item => {
            html += `
                <tr>
                    <td>${item.date}</td>
                    <td class="text-right">Rs.${formatNumber(item.total)}</td>
                </tr>
             `;
        });
        html += `
                </tbody>
            </table>
            <div class="divider"></div>
        `;
    }

    html += `
            <div class="text-center" style="margin-top: 10px; font-size: 11px;">
                Report Generated Successfully
            </div>
        </body>
        </html>
    `;

    return html;
}

window.printDailyReport = () => {
    const dateInput = document.getElementById('reportDailyDate');
    if (!dateInput || !dateInput.value) {
        alert('Please select a date first.');
        return;
    }

    const selectedDate = new Date(dateInput.value);
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const html = generateReportHTML(
        'Daily Report',
        `Daily | ${dateInput.value}`,
        startOfDay,
        endOfDay,
        null,
        null
    );

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 250);
};

window.printMonthlyReport = () => {
    const monthInput = document.getElementById('reportMonthlyMonth');
    if (!monthInput || !monthInput.value) {
        alert('Please select a month first.');
        return;
    }

    const [year, month] = monthInput.value.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch for details (Daily Breakdown)
    const sales = Storage.get('sales') || [];
    const filteredSales = sales.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });

    const dailyMap = {};
    filteredSales.forEach(s => {
        const d = new Date(s.date);
        const day = d.getDate();
        if (!dailyMap[day]) dailyMap[day] = 0;
        dailyMap[day] += (parseFloat(s.total) || 0);
    });

    const dailyBreakdown = [];
    const daysInMonth = endDate.getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        if (dailyMap[i]) {
            dailyBreakdown.push({
                date: `${year}-${month}-${String(i).padStart(2, '0')}`,
                total: dailyMap[i]
            });
        }
    }

    const html = generateReportHTML(
        'Monthly Report',
        `Monthly | ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        startDate,
        endDate,
        null,
        dailyBreakdown
    );

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 250);
};

window.printWeeklyReport = () => {
    const weekInput = document.getElementById('reportWeeklyWeek');
    if (!weekInput || !weekInput.value) {
        alert('Please select a week first.');
        return;
    }

    const [year, week] = weekInput.value.split('-W');
    // Calculate week start date (ISO 8601 week starts on Monday)
    // Simple approximation: Jan 4th is always in week 1
    const simpleDate = new Date(year, 0, 4);
    const dayShift = simpleDate.getDay() || 7;
    const startOfWeekOne = new Date(year, 0, 4 - dayShift + 1);
    const startDate = new Date(startOfWeekOne.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    // Filter Sales
    const sales = Storage.get('sales') || [];
    const filteredSales = sales.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });

    const dailyMap = {};
    filteredSales.forEach(s => {
        const d = new Date(s.date);
        const dateKey = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
        if (!dailyMap[dateKey]) dailyMap[dateKey] = 0;
        dailyMap[dateKey] += (parseFloat(s.total) || 0);
    });

    const dailyBreakdown = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateKey = d.toLocaleDateString('en-CA');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

        if (dailyMap[dateKey] || i < 7) { // Show all days of week
            dailyBreakdown.push({
                date: `${dateKey} (${dayName})`,
                total: dailyMap[dateKey] || 0
            });
        }
    }

    const html = generateReportHTML(
        'Weekly Report',
        `Week ${week}, ${year}`,
        startDate,
        endDate,
        null,
        dailyBreakdown,
        'Daily Breakdown',
        'Date'
    );

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 250);
};

window.printAnnualReport = () => {
    const yearInput = document.getElementById('reportAnnualYear');
    if (!yearInput || !yearInput.value) {
        alert('Please select a year first.');
        return;
    }

    const year = parseInt(yearInput.value);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const sales = Storage.get('sales') || [];
    const filteredSales = sales.filter(s => {
        if (!s.date) return false;
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
    });

    const monthlyMap = {};
    filteredSales.forEach(s => {
        const d = new Date(s.date);
        const m = d.getMonth();
        if (!monthlyMap[m]) monthlyMap[m] = 0;
        monthlyMap[m] += (parseFloat(s.total) || 0);
    });

    const monthlyBreakdown = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (let i = 0; i < 12; i++) {
        monthlyBreakdown.push({
            date: monthNames[i],
            total: monthlyMap[i] || 0
        });
    }

    const html = generateReportHTML(
        'Annual Report',
        `Year ${year}`,
        startDate,
        endDate,
        null,
        monthlyBreakdown,
        'Monthly Breakdown',
        'Month'
    );

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 250);
};

window.printStockReport = () => {
    const stockItems = Storage.get('stocks') || [];

    // Sort logic
    stockItems.sort((a, b) => (a.itemName || '').localeCompare(b.itemName || ''));

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    let html = `
        <html>
        <head>
            <title>Stock Report</title>
            <style>
                body { 
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
                    font-size: 11px; 
                    width: 300px; 
                    margin: 0 auto; 
                    padding: 5px;
                    color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .header { margin-bottom: 5px; text-align: center;}
                .header h1 { font-size: 18px; margin: 0; font-weight: 900; }
                .header p { margin: 1px 0; font-size: 11px; }
                .divider { border-bottom: 1px dashed black; margin: 3px 0; }
                .report-title { font-size: 14px; font-weight: bold; text-decoration: underline; margin: 3px 0; text-transform: uppercase;}
                .meta-info { font-size: 11px; margin-bottom: 3px; }
                
                .section-title { font-size: 13px; font-weight: bold; margin: 5px 0 2px 0; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                th { text-align: left; border-bottom: 1px solid black; padding: 2px 0; font-size: 12px; }
                td { padding: 2px 0; font-size: 11px; border-bottom: 1px dotted #ccc; }
                .col-name { width: 60%; }
                .col-qty { width: 40%; text-align: right; }

                @media print {
                    body { width: 100%; margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>ABC Restaurant</h1>
                <p>Stock Report</p>
                <p>${dateStr} ${timeStr}</p>
            </div>
            
            <div class="divider"></div>
            
            <table>
                <thead>
                    <tr>
                        <th class="col-name">Item Name</th>
                        <th class="col-qty">Stock Available</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (stockItems.length === 0) {
        html += `<tr><td colspan="2" class="text-center">No stock items found.</td></tr>`;
    } else {
        stockItems.forEach(item => {
            const quantity = parseFloat(item.quantity) || 0;
            const qtyDisplay = Number(quantity.toFixed(2));

            html += `
                <tr>
                    <td class="col-name">${item.itemName || 'Unknown Item'}</td>
                    <td class="col-qty">${qtyDisplay} ${item.unit}</td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
            
            <div class="divider"></div>
            <div class="text-center" style="font-size: 10px; margin-top: 5px;">End of Report</div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow.document.write(html);
    printWindow.document.close();

    // Auto print
    printWindow.onload = function () {
        setTimeout(function () {
            printWindow.print();
            printWindow.close();
        }, 500);
    };
};

// --- DUMMY DATA INJECTION ---
(function injectDummyData() {
    if (localStorage.getItem('dummyDataV1') === 'true') return;

    const StorageLocal = {
        get: (key) => {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        },
        set: (key, value) => localStorage.setItem(key, JSON.stringify(value))
    };

    // 1. Employees
    const employees = StorageLocal.get('employees');
    if (employees.length === 0) {
        employees.push({
            id: 'emp_' + Date.now(),
            name: 'Ali Ahmed',
            phone: '0300-1234567',
            salary: 45000,
            role: 'Chef',
            joinDate: '2025-01-10'
        });
        employees.push({
            id: 'emp_' + (Date.now() + 1),
            name: 'Usman Khan',
            phone: '0300-7654321',
            salary: 30000,
            role: 'Waiter',
            joinDate: '2025-02-15'
        });
        StorageLocal.set('employees', employees);
    }

    // 2. Waiters
    const waiters = StorageLocal.get('waiters');
    if (waiters.length === 0) {
        waiters.push({ id: 'w_1', name: 'Usman Khan', active: true });
        waiters.push({ id: 'w_2', name: 'Zain Ali', active: true });
        waiters.push({ id: 'w_3', name: 'Farhan', active: true });
        StorageLocal.set('waiters', waiters);
    }

    // 3. Expenses
    const expenses = StorageLocal.get('expenses');
    if (expenses.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        expenses.push({ id: 'exp_' + Date.now(), category: 'Kitchen', amount: 5000, date: today, description: 'Vegetables and Meat' });
        expenses.push({ id: 'exp_' + (Date.now()+1), category: 'Utility Bill', amount: 12000, date: today, description: 'Electricity Bill' });
        expenses.push({ id: 'exp_' + (Date.now()+2), category: 'Maintenance', amount: 2500, date: today, description: 'Plumbing repair' });
        StorageLocal.set('expenses', expenses);
    }

    // 4. Stocks
    const stocks = StorageLocal.get('stocks');
    if (stocks.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        stocks.push({ id: 'stk_' + Date.now(), itemName: 'Chicken', quantity: 50, price: 650, supplierName: 'Asif Poultry', date: today, paymentStatus: 'paid', unit: 'kg' });
        stocks.push({ id: 'stk_' + (Date.now()+1), itemName: 'Cooking Oil', quantity: 15, price: 450, supplierName: 'Metro', date: today, paymentStatus: 'unpaid', unit: 'liters' });
        stocks.push({ id: 'stk_' + (Date.now()+2), itemName: 'Flour', quantity: 100, price: 120, supplierName: 'Ali Traders', date: today, paymentStatus: 'paid', unit: 'kg' });
        StorageLocal.set('stocks', stocks);
    }

    // 5. Sales
    const sales = StorageLocal.get('sales');
    if (sales.length === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const dummySale1 = {
            id: 'ORD-' + Date.now(),
            date: todayStr,
            time: timeStr,
            customerName: 'Ahmad',
            location: 'Dine-In',
            waiter: 'Usman Khan',
            paymentMethod: 'Cash',
            items: [
                { id: 'item_1', name: 'Chicken Half Karahi', price: 800, quantity: 2, total: 1600 }
            ],
            subtotal: 1600,
            discount: { type: 'fixed', value: 0, amount: 0 },
            total: 1600
        };

        const dummySale2 = {
            id: 'ORD-' + (Date.now() + 1),
            date: todayStr,
            time: timeStr,
            customerName: 'Customer 2',
            location: 'Takeaway',
            waiter: '',
            paymentMethod: 'Card',
            items: [
                { id: 'item_2', name: 'Beef Full Karahi', price: 1700, quantity: 1, total: 1700 },
                { id: 'item_3', name: 'Roti', price: 20, quantity: 5, total: 100 }
            ],
            subtotal: 1800,
            discount: { type: 'percentage', value: 10, amount: 180 },
            total: 1620
        };

        sales.push(dummySale1, dummySale2);
        StorageLocal.set('sales', sales);
    }

    localStorage.setItem('dummyDataV1', 'true');
    console.log('Dummy data injected successfully!');
    
    // Automatically reload the window once so that the UI can pick up the dummy data
    setTimeout(() => {
        if (!sessionStorage.getItem('dummyReloaded')) {
            sessionStorage.setItem('dummyReloaded', 'true');
            window.location.reload();
        }
    }, 500);
})();
