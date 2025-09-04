/**
 * Profit Prediction Calculator JavaScript
 * Handles real-time calculations, chart generation, and export functionality
 */

(function($) {
    'use strict';
    
    let calculationData = null;
    let profitChart = null;
    let debounceTimer = null;
    
    $(document).ready(function() {
        initializeCalculator();
    });
    
    function initializeCalculator() {
        // Bind input events for real-time calculation
        $('#profit-calculator-form input').on('input change', debounceCalculation);
        
        // Bind export button events
        $('#export-pdf').on('click', function() {
            exportReport('pdf');
        });
        
        $('#export-csv').on('click', function() {
            exportReport('csv');
        });
        
        // Add input validation and formatting
        addInputValidation();
        
        // Add loading states and animations
        initializeAnimations();
    }
    
    function debounceCalculation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            if (validateRequiredFields()) {
                performCalculation();
            } else {
                hideResults();
            }
        }, 300); // 300ms debounce
    }
    
    function validateRequiredFields() {
        const requiredFields = [
            'user_name', 'user_email', 'initial_investment',
            'monthly_revenue', 'monthly_costs', 'growth_rate'
        ];
        
        for (let field of requiredFields) {
            const value = $('#' + field).val();
            if (!value || value.trim() === '') {
                return false;
            }
        }
        
        // Validate email format
        const email = $('#user_email').val();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return false;
        }
        
        // Validate numeric fields
        const numericFields = ['initial_investment', 'monthly_revenue', 'monthly_costs', 'growth_rate'];
        for (let field of numericFields) {
            const value = parseFloat($('#' + field).val());
            if (isNaN(value) || value < 0) {
                return false;
            }
        }
        
        return true;
    }
    
    function performCalculation() {
        const formData = $('#profit-calculator-form').serialize();
        
        showLoading();
        hideError();
        
        $.ajax({
            url: ppc_ajax.ajax_url,
            type: 'POST',
            data: formData + '&action=calculate_profit&nonce=' + ppc_ajax.nonce,
            timeout: 10000, // 10 second timeout
            success: function(response) {
                hideLoading();
                
                if (response.success && response.data) {
                    calculationData = response.data;
                    displayResults(response.data);
                    trackCalculationEvent(); // Analytics tracking
                } else {
                    const errorMsg = response.data || 'Calculation failed. Please check your inputs and try again.';
                    showError(errorMsg);
                }
            },
            error: function(xhr, status, error) {
                hideLoading();
                let errorMessage = 'Connection error. Please try again.';
                
                if (status === 'timeout') {
                    errorMessage = 'Request timeout. Please try again.';
                } else if (xhr.status === 403) {
                    errorMessage = 'Permission denied. Please refresh the page and try again.';
                }
                
                showError(errorMessage);
                console.error('AJAX Error:', {xhr, status, error});
            }
        });
    }
    
    function displayResults(data) {
        // Update summary cards with animations
        animateValue('#roi-value', data.roi, '%', 1000);
        animateValue('#profit-value', data.total_profit, '$', 1000, true);
        $('#breakeven-value').text(data.break_even_month);
        
        // Update detailed table
        updateProjectionTable(data.projections);
        
        // Create or update chart
        createProfitChart(data.projections);
        
        // Show results section with animation
        $('#calculation-results').slideDown(500);
        
        // Scroll to results
        $('html, body').animate({
            scrollTop: $('#calculation-results').offset().top - 50
        }, 500);
    }
    
    function updateProjectionTable(projections) {
        const tbody = $('#projection-table tbody');
        tbody.empty();
        
        projections.forEach(function(projection, index) {
            const profitClass = projection.net_profit >= 0 ? 'positive' : 'negative';
            const row = $(`
                <tr class="table-row-animate" style="animation-delay: ${index * 100}ms">
                    <td><strong>Month ${projection.month}</strong></td>
                    <td class="currency">$${formatNumber(projection.revenue)}</td>
                    <td class="currency">$${formatNumber(projection.costs)}</td>
                    <td class="currency">$${formatNumber(projection.profit)}</td>
                    <td class="currency">$${formatNumber(projection.cumulative_profit)}</td>
                    <td class="currency ${profitClass}">$${formatNumber(projection.net_profit)}</td>
                </tr>
            `);
            tbody.append(row);
        });
        
        // Trigger row animations
        setTimeout(function() {
            $('.table-row-animate').addClass('fade-in');
        }, 100);
    }
    
    function createProfitChart(projections) {
        const ctx = document.getElementById('profit-chart').getContext('2d');
        
        // Destroy existing chart
        if (profitChart) {
            profitChart.destroy();
        }
        
        const months = projections.map(p => 'Month ' + p.month);
        const revenues = projections.map(p => p.revenue);
        const costs = projections.map(p => p.costs);
        const netProfits = projections.map(p => p.net_profit);
        const cumulativeProfits = projections.map(p => p.cumulative_profit);
        
        profitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Monthly Revenue',
                        data: revenues,
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        borderWidth: 3
                    },
                    {
                        label: 'Monthly Costs',
                        data: costs,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        borderWidth: 3
                    },
                    {
                        label: 'Net Profit',
                        data: netProfits,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.2)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        borderWidth: 3
                    },
                    {
                        label: 'Cumulative Profit',
                        data: cumulativeProfits,
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155, 89, 182, 0.1)',
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '6-Month Financial Projection',
                        font: {
                            size: 18,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255,255,255,0.2)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + formatNumber(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + formatNumber(value);
                            }
                        },
                        title: {
                            display: true,
                            text: 'Amount ($)',
                            font: {
                                weight: 'bold'
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        },
                        title: {
                            display: true,
                            text: 'Time Period',
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }
    
    function exportReport(format) {
        if (!calculationData) {
            showError('No calculation data available for export.');
            return;
        }
        
        // Show loading state for export
        const button = format === 'pdf' ? '#export-pdf' : '#export-csv';
        const originalText = $(button).text();
        $(button).prop('disabled', true).text('Generating...');
        
        $.ajax({
            url: ppc_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'export_report',
                nonce: ppc_ajax.nonce,
                format: format,
                data: JSON.stringify(calculationData)
            },
            xhrFields: {
                responseType: 'blob'
            },
            success: function(data) {
                const blob = new Blob([data]);
                const link = document.createElement('a');
                const url = window.URL.createObjectURL(blob);
                
                link.href = url;
                link.download = `profit-prediction-report-${getCurrentDate()}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                // Reset button state
                $(button).prop('disabled', false).text(originalText);
                
                // Track export event
                trackExportEvent(format);
            },
            error: function() {
                $(button).prop('disabled', false).text(originalText);
                showError(`${format.toUpperCase()} export failed. Please try again.`);
            }
        });
    }
    
    function addInputValidation() {
        // Format currency inputs
        $('input[name="initial_investment"], input[name="monthly_revenue"], input[name="monthly_costs"]').on('blur', function() {
            const value = parseFloat($(this).val());
            if (!isNaN(value) && value >= 0) {
                $(this).val(value.toFixed(2));
            }
        });
        
        // Format growth rate input
        $('input[name="growth_rate"]').on('blur', function() {
            const value = parseFloat($(this).val());
            if (!isNaN(value)) {
                $(this).val(value.toFixed(1));
            }
        });
        
        // Add real-time validation feedback
        $('#user_email').on('blur', function() {
            const email = $(this).val();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (email && !emailRegex.test(email)) {
                $(this).addClass('invalid');
                showFieldError(this, 'Please enter a valid email address.');
            } else {
                $(this).removeClass('invalid');
                hideFieldError(this);
            }
        });
    }
    
    function initializeAnimations() {
        // Add CSS for animations
        const style = document.createElement('style');
        style.textContent = `
            .table-row-animate {
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.5s ease;
            }
            .table-row-animate.fade-in {
                opacity: 1;
                transform: translateY(0);
            }
            .currency.positive {
                color: #27ae60;
                font-weight: bold;
            }
            .currency.negative {
                color: #e74c3c;
                font-weight: bold;
            }
            .ppc-field input.invalid {
                border-color: #e74c3c !important;
                box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.1) !important;
            }
            .field-error {
                color: #e74c3c;
                font-size: 0.8em;
                margin-top: 3px;
                display: block;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Utility Functions
    function animateValue(selector, endValue, prefix = '', duration = 1000, isNumber = false) {
        const element = $(selector);
        const startValue = 0;
        const startTime = Date.now();
        
        function updateValue() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (endValue - startValue) * easedProgress;
            
            let displayValue;
            if (isNumber) {
                displayValue = prefix + formatNumber(currentValue);
            } else {
                displayValue = currentValue.toFixed(2) + prefix;
            }
            
            element.text(displayValue);
            
            if (progress < 1) {
                requestAnimationFrame(updateValue);
            }
        }
        
        requestAnimationFrame(updateValue);
    }
    
    function formatNumber(num) {
        return Math.abs(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    function getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }
    
    function showLoading() {
        $('#ppc-loading').fadeIn(200);
    }
    
    function hideLoading() {
        $('#ppc-loading').fadeOut(200);
    }
    
    function showError(message) {
        $('#ppc-error').text(message).slideDown(300);
        setTimeout(function() {
            $('#ppc-error').slideUp(300);
        }, 5000);
    }
    
    function hideError() {
        $('#ppc-error').slideUp(200);
    }
    
    function hideResults() {
        $('#calculation-results').slideUp(300);
    }
    
    function showFieldError(field, message) {
        hideFieldError(field);
        $(field).after(`<span class="field-error">${message}</span>`);
    }
    
    function hideFieldError(field) {
        $(field).siblings('.field-error').remove();
    }
    
    // Analytics tracking functions (optional)
    function trackCalculationEvent() {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'calculation', {
                event_category: 'profit_calculator',
                event_label: 'calculation_completed'
            });
        }
    }
    
    function trackExportEvent(format) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'export', {
                event_category: 'profit_calculator',
                event_label: 'report_exported',
                value: format
            });
        }
    }
    
})(jQuery);
