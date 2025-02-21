from flask import Flask, render_template, request, jsonify, send_file, session, redirect, url_for
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
import time
import yaml
import tempfile
import os
import io
from datetime import datetime
import shutil
import zipfile
from uuid import uuid4
import pandas as pd
from flask import send_from_directory

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Replace with your actual secret key

gstsite = "https://www.gst.gov.in/"

# Dictionary to store WebDriver instances
drivers = {}
# In-memory store for progress tracking
progress_store = {}

def update_progress(user_id, status):
    progress_store[user_id] = status

# Load credentials from the YAML file
def load_credentials():
    with open('data/config.yaml', 'r') as file:
        config = yaml.safe_load(file)
    return config['clients']

# Save credentials to the YAML file
def save_credentials(clients):
    config_file = 'data/config.yaml'
    with open(config_file, 'r') as file:
        config = yaml.safe_load(file)
    config['clients'] = clients
    with open(config_file, 'w') as file:
        yaml.safe_dump(config, file)

# Check if a client has a password
@app.route('/check_password', methods=['POST'])
def check_password():
    data = request.json
    client_name = data.get('client')
    clients = load_credentials()
    client = next((client for client in clients if client['name'] == client_name), None)

    if client is None:
        return jsonify({"success": False, "message": "Client not found"}), 404

    if client.get('password'):
        return jsonify({"has_password": True})
    else:
        return jsonify({"has_password": False})

# Save password for a client
@app.route('/save_password', methods=['POST'])
def save_password():
    data = request.json
    client_name = data.get('client')
    password = data.get('password')

    clients = load_credentials()
    client = next((client for client in clients if client['name'] == client_name), None)

    if client is None:
        return jsonify({"success": False, "message": "Client not found"}), 404

    client['password'] = password
    save_credentials(clients)

    return jsonify({"success": True, "message": "Password saved successfully"})

@app.route('/')
def select_client():
    if 'user_id' not in session:
        session['user_id'] = str(uuid4())

    clients = load_credentials()
    return render_template('index.html', client_names=[client['name'] for client in clients])

@app.route('/manage_clients')
def manage_clients():
    clients = load_credentials()
    return render_template('manage_clients.html', client_names=[client['name'] for client in clients])

@app.route('/add_client', methods=['POST'])
def add_client():
    clients = load_credentials()

    # Handle XLSX upload
    if 'xlsxFile' in request.files:
        file = request.files['xlsxFile']
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(file)
            for index, row in df.iterrows():
                name = row.get('Client Name')
                username = row.get('Username')
                password = row.get('Password')

                if name and username and password:
                    # Check if client already exists
                    existing_client = next((client for client in clients if client['name'] == name), None)

                    if existing_client:
                        # Update the existing client's username and password
                        existing_client['username'] = username
                        existing_client['password'] = password
                    else:
                        # Add new client
                        clients.append({
                            'name': name,
                            'username': username,
                            'password': password
                        })
            save_credentials(clients)
            return jsonify({"success": True, "message": "Clients added or updated from XLSX successfully."})
        else:
            return jsonify({"success": False, "message": "Invalid file format. Please upload an XLSX file."})

    # Handle manual form input
    elif request.is_json:
        data = request.get_json()
        name = data.get('name')
        username = data.get('username')
        password = data.get('password')

        if not name or not username or not password:
            return jsonify({"success": False, "message": "Missing client details."})

        # Check if client already exists
        existing_client = next((client for client in clients if client['name'] == name), None)

        if existing_client:
            # Update existing client
            existing_client['username'] = username
            existing_client['password'] = password
            message = "Client updated successfully."
        else:
            # Add new client
            clients.append({
                'name': name,
                'username': username,
                'password': password
            })
            message = "Client added successfully."

        save_credentials(clients)
        return jsonify({"success": True, "message": message})

    # If neither XLSX nor manual input provided
    else:
        return jsonify({"success": False, "message": "No valid input provided."})


@app.route('/modify_client', methods=['POST'])
def modify_client():
    data = request.json
    client_name = data['name']

    # Load existing clients
    clients = load_credentials()

    # Find the client to modify
    client = next((client for client in clients if client['name'] == client_name), None)

    if client is None:
        return jsonify({"success": False, "message": "Client not found"})

    # Update the client details without checking the old password
    client['name'] = data.get('new_name', client['name'])
    client['username'] = data.get('username', client['username'])
    client['password'] = data.get('password', client['password'])

    # Save the updated config back to the file
    save_credentials(clients)

    return jsonify({"success": True, "message": "Client modified successfully"})


@app.route('/delete_client', methods=['POST'])
def delete_client():
    data = request.json
    client_name = data['name']

    # Load existing clients
    clients = load_credentials()

    # Find the client
    client = next((client for client in clients if client['name'] == client_name), None)

    if client is None:
        return jsonify({"success": False, "message": "Client not found"})

    # Remove the client from the list
    clients = [client for client in clients if client['name'] != client_name]

    # Save the updated list back to the file
    save_credentials(clients)

    return jsonify({"success": True, "message": "Client deleted successfully"})


@app.route('/get_captcha', methods=['POST'])
def get_captcha():
    if 'user_id' not in session:
        return redirect(url_for('select_client'))

    user_id = session['user_id']
    if user_id not in drivers:
        drivers[user_id] = init_webdriver()

    driver = drivers[user_id]

    data = request.json
    selected_client_name = data['client']
    clients = load_credentials()

    selected_client = next((client for client in clients if client['name'] == selected_client_name), None)

    if selected_client is None:
        return jsonify({"error": "Client not found"}), 404

    username = selected_client['username']
    password = selected_client['password']

    if not password:
        return jsonify({"error": "Password missing for this client."}), 400

    # Navigate to the GST login page
    driver.get('https://services.gst.gov.in/services/login')

    # Wait until the username field is present
    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, 'username')))

    # Type the username and password
    driver.find_element(By.ID, 'username').send_keys(username)
    driver.find_element(By.ID, 'user_pass').send_keys(password)

    # Wait for the CAPTCHA image to be present and fully loaded
    WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, 'imgCaptcha')))
    time.sleep(2)  # Additional wait to ensure the CAPTCHA is fully loaded

    # Get the CAPTCHA image element
    captcha_element = driver.find_element(By.ID, 'imgCaptcha')
    captcha_screenshot = captcha_element.screenshot_as_base64

    return jsonify({"captcha_image": captcha_screenshot})

@app.route('/perform_search', methods=['POST'])
def perform_search():
    if 'user_id' not in session or session['user_id'] not in drivers:
        return redirect(url_for('select_client'))

    user_id = session['user_id']
    progress_store[user_id] = "Starting process..."  # Initialize progress
    driver = drivers[user_id]

    data = request.json
    captcha_input = data['captcha_input']
    fin_year = data['fin_year']
    quarter = data['quarter']
    period = data['period']

    try:
        # Step 1: Submit CAPTCHA and login
        update_progress(user_id, 'Submitting CAPTCHA...')
        captcha_field = driver.find_element(By.ID, 'captcha')
        captcha_field.send_keys(captcha_input)
        login_button = driver.find_element(By.CSS_SELECTOR, '.btn-primary')
        login_button.click()

        # Step 2: Check if login was successful
        try:
            WebDriverWait(driver, 10).until(EC.url_contains('/auth/fowelcome'))
        except TimeoutException:
            # Login failed, handle failure here
            print("login failed, please try again")
            update_progress(user_id, 'Login failed')
            return jsonify({"success": False, "message": "login failed, please try again"}), 401

        # Step 3: Navigate to the dashboard
        update_progress(user_id, 'Navigating to dashboard...')
        driver.get(gstsite)  # Navigate to the GST home page
        dashboard_link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[@data-ng-href='//services.gst.gov.in/services/auth/dashboard']"))
        )
        dashboard_link.click()

        # Step 4: Navigate to File Returns and perform the search
        update_progress(user_id, 'Searching for the record...')
        file_returns_button = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//span[@data-ng-bind='trans.LBL_FILE_RETUR']/ancestor::a"))
        )
        time.sleep(3)
        driver.execute_script("arguments[0].scrollIntoView();", file_returns_button)
        file_returns_button.click()
        time.sleep(5)

        # Step 5: Fill in the Financial Year, Quarter, and Period
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.NAME, 'fin'))
        )

        # Select Financial Year
        fin_year_select = Select(driver.find_element(By.NAME, 'fin'))
        try:
            fin_year_select.select_by_visible_text(fin_year)
        except NoSuchElementException:
            return jsonify({"success": False, "message": f"Document for the selected financial year {fin_year} unavailable"}), 400

        # Select Quarter
        quarter_select = Select(driver.find_element(By.NAME, 'quarter'))
        try:
            quarter_select.select_by_visible_text(quarter)
        except NoSuchElementException:
            return jsonify({"success": False, "message": f"Document for the selected quarter {quarter} unavailable"}), 400

        # Select Period
        period_select = Select(driver.find_element(By.NAME, 'mon'))
        try:
            period_select.select_by_visible_text(period)
        except NoSuchElementException:
            return jsonify({"success": False, "message": f"Document for the selected period {period} unavailable"}), 400

        # Click the search button
        search_button = driver.find_element(By.CSS_SELECTOR, '.srchbtn')
        search_button.click()

        # Step 6: Download the forms
        update_progress(user_id, 'Preparing for download...')
        temp_dir = tempfile.mkdtemp(prefix=f"{datetime.now().strftime('%Y%m%d')}_{quarter}_{period}_")
        driver.execute_cdp_cmd('Page.setDownloadBehavior', {
            'behavior': 'allow',
            'downloadPath': temp_dir
        })

        time.sleep(5)

        update_progress(user_id, 'Zipping files...')
        json_download_button = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//p[text()='GSTR2B']/following::button[contains(text(), 'Download')]"))
        )
        json_download_button.click()

        json_file_button = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'GENERATE JSON FILE TO DOWNLOAD') and @class='btn btn-primary']"))
        )
        json_file_button.click()

        excel_file_button = WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'GENERATE EXCEL FILE TO DOWNLOAD') and @class='btn btn-primary']"))
        )
        excel_file_button.click()
        time.sleep(2)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w') as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    zipf.write(os.path.join(root, file), file)

        shutil.rmtree(temp_dir)
        zip_buffer.seek(0)

        update_progress(user_id, 'Completed')
        return send_file(zip_buffer, mimetype='application/zip', download_name='GST_Documents.zip', as_attachment=True)

    except Exception as e:
        error_message = "An error occurred during processing."
        update_progress(user_id, 'Error occurred')
        return jsonify({"success": False, "message": error_message, "error": str(e)})


@app.route('/progress', methods=['GET'])
def progress():
    user_id = session.get('user_id')
    if user_id and user_id in progress_store:
        return jsonify({"progress": progress_store[user_id]})
    else:
        return jsonify({"progress": "No progress information available"})

@app.route('/download_sample')
def download_sample():
    try:
        data_directory = os.path.join(os.getcwd(), 'data')
        return send_from_directory(directory=data_directory, path='sample.xlsx', as_attachment=True)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

@app.route('/get_clients', methods=['GET'])
def get_clients():
    clients = load_credentials() 
    return jsonify({'clients': clients})


def init_webdriver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920x1080')
    driver = webdriver.Chrome(options=options)
    return driver

if __name__ == '__main__':
    app.run("0.0.0.0", 80, debug=False)
