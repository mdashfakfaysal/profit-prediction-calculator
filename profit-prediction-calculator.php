<?php
/**
 * Plugin Name: Profit Prediction Calculator
 * Plugin URI: https://yourwebsite.com
 * Description: Advanced ROI and Growth Rate calculator with real-time predictions and admin analytics
 * Version: 1.0.0
 * Author: Your Name
 * License: GPL v2 or later
 * Text Domain: profit-calculator
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('PPC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('PPC_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('PPC_VERSION', '1.0.0');

class ProfitPredictionCalculator {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_shortcode('profit_calculator', array($this, 'display_calculator'));
        add_action('wp_ajax_calculate_profit', array($this, 'ajax_calculate_profit'));
        add_action('wp_ajax_nopriv_calculate_profit', array($this, 'ajax_calculate_profit'));
        add_action('wp_ajax_export_report', array($this, 'ajax_export_report'));
        add_action('admin_menu', array($this, 'admin_menu'));
    }
    
    public function activate() {
        $this->create_tables();
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    private function create_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'profit_calculations';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            user_name varchar(100) NOT NULL,
            user_email varchar(100) NOT NULL,
            company_name varchar(100) DEFAULT '',
            initial_investment decimal(15,2) NOT NULL,
            monthly_revenue decimal(15,2) NOT NULL,
            monthly_costs decimal(15,2) NOT NULL,
            growth_rate decimal(5,2) NOT NULL,
            calculated_roi decimal(10,2) NOT NULL,
            projected_profit decimal(15,2) NOT NULL,
            break_even_month int(3) NOT NULL,
            calculation_date datetime DEFAULT CURRENT_TIMESTAMP,
            user_ip varchar(45) NOT NULL,
            PRIMARY KEY (id)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script('jquery');
        wp_enqueue_script('chart-js', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js', array(), '3.9.1', true);
        wp_enqueue_script('ppc-calculator', PPC_PLUGIN_URL . 'assets/calculator.js', array('jquery', 'chart-js'), PPC_VERSION, true);
        wp_enqueue_style('ppc-styles', PPC_PLUGIN_URL . 'assets/styles.css', array(), PPC_VERSION);
        
        wp_localize_script('ppc-calculator', 'ppc_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ppc_nonce')
        ));
    }
    
    public function admin_enqueue_scripts($hook) {
        if (strpos($hook, 'profit-calculator') !== false) {
            wp_enqueue_script('chart-js', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js', array(), '3.9.1', true);
            wp_enqueue_script('ppc-admin', PPC_PLUGIN_URL . 'assets/admin.js', array('jquery', 'chart-js'), PPC_VERSION, true);
            wp_enqueue_style('ppc-admin-styles', PPC_PLUGIN_URL . 'assets/admin-styles.css', array(), PPC_VERSION);
        }
    }
    
    public function display_calculator($atts) {
        ob_start();
        include PPC_PLUGIN_PATH . 'templates/calculator-form.php';
        return ob_get_clean();
    }
    
    public function ajax_calculate_profit() {
        check_ajax_referer('ppc_nonce', 'nonce');
        
        $data = $this->sanitize_input($_POST);
        $calculations = $this->perform_calculations($data);
        
        // Store in database
        $this->store_calculation($data, $calculations);
        
        wp_send_json_success($calculations);
    }
    
    public function ajax_export_report() {
        check_ajax_referer('ppc_nonce', 'nonce');
        
        $data = json_decode(stripslashes($_POST['data']), true);
        
        // Generate PDF or CSV based on format
        $format = sanitize_text_field($_POST['format']);
        
        if ($format === 'pdf') {
            $this->generate_pdf_report($data);
        } else {
            $this->generate_csv_report($data);
        }
    }
    
    private function sanitize_input($input) {
        return array(
            'user_name' => sanitize_text_field($input['user_name']),
            'user_email' => sanitize_email($input['user_email']),
            'company_name' => sanitize_text_field($input['company_name']),
            'initial_investment' => floatval($input['initial_investment']),
            'monthly_revenue' => floatval($input['monthly_revenue']),
            'monthly_costs' => floatval($input['monthly_costs']),
            'growth_rate' => floatval($input['growth_rate'])
        );
    }
    
    private function perform_calculations($data) {
        $months = 6;
        $projections = array();
        $cumulative_profit = 0;
        $break_even_month = 0;
        
        for ($i = 1; $i <= $months; $i++) {
            // Apply growth rate
            $growth_multiplier = pow(1 + ($data['growth_rate'] / 100), $i - 1);
            $monthly_revenue = $data['monthly_revenue'] * $growth_multiplier;
            $monthly_profit = $monthly_revenue - $data['monthly_costs'];
            $cumulative_profit += $monthly_profit;
            
            // Calculate net profit (considering initial investment)
            $net_profit = $cumulative_profit - $data['initial_investment'];
            
            // Determine break-even month
            if ($break_even_month == 0 && $net_profit > 0) {
                $break_even_month = $i;
            }
            
            $projections[] = array(
                'month' => $i,
                'revenue' => round($monthly_revenue, 2),
                'costs' => $data['monthly_costs'],
                'profit' => round($monthly_profit, 2),
                'cumulative_profit' => round($cumulative_profit, 2),
                'net_profit' => round($net_profit, 2)
            );
        }
        
        // Calculate ROI
        $total_profit = $cumulative_profit - $data['initial_investment'];
        $roi = ($data['initial_investment'] > 0) ? (($total_profit / $data['initial_investment']) * 100) : 0;
        
        return array(
            'roi' => round($roi, 2),
            'total_profit' => round($total_profit, 2),
            'break_even_month' => $break_even_month ?: 'Not within 6 months',
            'projections' => $projections,
            'summary' => array(
                'initial_investment' => $data['initial_investment'],
                'total_revenue_6m' => round(array_sum(array_column($projections, 'revenue')), 2),
                'total_costs_6m' => round($data['monthly_costs'] * 6, 2),
                'growth_rate' => $data['growth_rate']
            )
        );
    }
    
    private function store_calculation($data, $calculations) {
        global $wpdb;
        
        $wpdb->insert(
            $wpdb->prefix . 'profit_calculations',
            array(
                'user_name' => $data['user_name'],
                'user_email' => $data['user_email'],
                'company_name' => $data['company_name'],
                'initial_investment' => $data['initial_investment'],
                'monthly_revenue' => $data['monthly_revenue'],
                'monthly_costs' => $data['monthly_costs'],
                'growth_rate' => $data['growth_rate'],
                'calculated_roi' => $calculations['roi'],
                'projected_profit' => $calculations['total_profit'],
                'break_even_month' => is_numeric($calculations['break_even_month']) ? $calculations['break_even_month'] : 0,
                'user_ip' => $_SERVER['REMOTE_ADDR']
            ),
            array('%s', '%s', '%s', '%f', '%f', '%f', '%f', '%f', '%f', '%d', '%s')
        );
    }
    
    private function generate_pdf_report($data) {
        // Simple HTML to PDF conversion
        $html = $this->get_report_html($data);
        
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="profit-prediction-report.pdf"');
        
        // For production, use a proper PDF library like TCPDF or mPDF
        // This is a simplified implementation
        echo $html;
        exit;
    }
    
    private function generate_csv_report($data) {
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="profit-prediction-report.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Headers
        fputcsv($output, array('Month', 'Revenue', 'Costs', 'Profit', 'Cumulative Profit', 'Net Profit'));
        
        // Data rows
        foreach ($data['projections'] as $projection) {
            fputcsv($output, array(
                $projection['month'],
                $projection['revenue'],
                $projection['costs'],
                $projection['profit'],
                $projection['cumulative_profit'],
                $projection['net_profit']
            ));
        }
        
        fclose($output);
        exit;
    }
    
    private function get_report_html($data) {
        ob_start();
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <title>Profit Prediction Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>Profit Prediction Report</h1>
            
            <div class="summary">
                <h2>Summary</h2>
                <p><strong>ROI:</strong> <?php echo $data['roi']; ?>%</p>
                <p><strong>Total Profit (6 months):</strong> $<?php echo number_format($data['total_profit'], 2); ?></p>
                <p><strong>Break-even Month:</strong> <?php echo $data['break_even_month']; ?></p>
            </div>
            
            <table>
                <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Costs</th>
                    <th>Profit</th>
                    <th>Cumulative Profit</th>
                    <th>Net Profit</th>
                </tr>
                <?php foreach ($data['projections'] as $projection): ?>
                <tr>
                    <td><?php echo $projection['month']; ?></td>
                    <td>$<?php echo number_format($projection['revenue'], 2); ?></td>
                    <td>$<?php echo number_format($projection['costs'], 2); ?></td>
                    <td>$<?php echo number_format($projection['profit'], 2); ?></td>
                    <td>$<?php echo number_format($projection['cumulative_profit'], 2); ?></td>
                    <td>$<?php echo number_format($projection['net_profit'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
            </table>
        </body>
        </html>
        <?php
        return ob_get_clean();
    }
    
    public function admin_menu() {
        add_menu_page(
            'Profit Calculator',
            'Profit Calculator',
            'manage_options',
            'profit-calculator',
            array($this, 'admin_page'),
            'dashicons-chart-line',
            30
        );
        
        add_submenu_page(
            'profit-calculator',
            'Analytics',
            'Analytics',
            'manage_options',
            'profit-calculator-analytics',
            array($this, 'analytics_page')
        );
    }
    
    public function admin_page() {
        include PPC_PLUGIN_PATH . 'templates/admin-dashboard.php';
    }
    
    public function analytics_page() {
        include PPC_PLUGIN_PATH . 'templates/admin-analytics.php';
    }
}

// Initialize the plugin
new ProfitPredictionCalculator();

// Create assets directory structure
function ppc_create_assets() {
    $upload_dir = wp_upload_dir();
    $ppc_dir = $upload_dir['basedir'] . '/profit-calculator/';
    
    if (!file_exists($ppc_dir)) {
        wp_mkdir_p($ppc_dir);
    }
}
add_action('init', 'ppc_create_assets');
?>
