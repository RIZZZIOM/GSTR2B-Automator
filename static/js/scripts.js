document.addEventListener('DOMContentLoaded', function() {
    // Populate the Financial Year dropdown with the last 5 years
    let finYearSelect = document.getElementById('fin_year');
    let currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
        let option = document.createElement('option');
        option.value = `${currentYear - i}-${(currentYear - i + 1).toString().slice(-2)}`;
        option.text = `${currentYear - i}-${(currentYear - i + 1).toString().slice(-2)}`;
        finYearSelect.add(option);
    }

    // Update Period options based on Quarter selection
    document.getElementById('quarter').addEventListener('change', function() {
        let periodSelect = document.getElementById('period');
        periodSelect.innerHTML = ''; // Clear existing options

        let selectedQuarter = this.value;
        let periods = [];

        if (selectedQuarter.includes('Apr - Jun')) {
            periods = ['April', 'May', 'June'];
        } else if (selectedQuarter.includes('Jul - Sep')) {
            periods = ['July', 'August', 'September'];
        } else if (selectedQuarter.includes('Oct - Dec')) {
            periods = ['October', 'November', 'December'];
        } else if (selectedQuarter.includes('Jan - Mar')) {
            periods = ['January', 'February', 'March'];
        }

        periods.forEach(function(period) {
            let option = document.createElement('option');
            option.value = period;
            option.text = period;
            periodSelect.add(option);
        });

        // Automatically select the last month in the quarter
        periodSelect.selectedIndex = periodSelect.options.length - 1;
    });

    // Trigger the quarter change event to set the default period
    document.getElementById('quarter').dispatchEvent(new Event('change'));

    // Handle form submission for downloading files
    document.getElementById('submitClient').onclick = function() {
        var selectedClient = document.getElementById('client').value;
        var finYear = document.getElementById('fin_year').value;
        var quarter = document.getElementById('quarter').value;
        var period = document.getElementById('period').value;

        // Check if the client has a password
        checkPasswordForClient(selectedClient).then(data => {
            if (!data.has_password) {
                // Show modal to ask for password if missing
                Swal.fire({
                    title: 'Enter Password',
                    html: `<input type="password" id="newPassword" class="swal2-input" placeholder="Enter password">`,
                    showCancelButton: true,
                    confirmButtonText: 'Save',
                    preConfirm: () => {
                        const password = Swal.getPopup().querySelector('#newPassword').value;
                        if (!password) {
                            Swal.showValidationMessage('Please enter a password');
                        }
                        return password;
                    }
                }).then(result => {
                    if (result.isConfirmed) {
                        saveClientPassword(selectedClient, result.value).then(() => {
                            proceedWithCaptcha(selectedClient, finYear, quarter, period);
                        });
                    }
                });
            } else {
                // Proceed directly if password exists
                proceedWithCaptcha(selectedClient, finYear, quarter, period);
            }
        });
    };

    // Close CAPTCHA modal
    document.getElementById('closeModal').onclick = function() {
        document.getElementById('captchaModal').style.display = 'none';
    };

    window.onclick = function(event) {
        if (event.target == document.getElementById('captchaModal')) {
            document.getElementById('captchaModal').style.display = 'none';
        }
    };

    // Handle Save Client button click for adding a new client
    document.getElementById('saveClient').onclick = function() {
        var clientName = document.getElementById('newClientName').value;
        var clientUsername = document.getElementById('newClientUsername').value;
        var clientPassword = document.getElementById('newClientPassword').value;

        if (clientName && clientUsername && clientPassword) {
            // Send the new client data to the server
            fetch('/add_client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: clientName,
                    username: clientUsername,
                    password: clientPassword,
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Client Added',
                        text: 'The new client has been added successfully!',
                    }).then(() => {
                        location.reload(); // Reload the page to reflect the new client in the dropdown
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'All fields are required!',
            });
        }
    };

    // Handle Save Modified Client button click for modifying an existing client
    document.getElementById('saveModifiedClient').onclick = function() {
        var selectedClient = document.getElementById('selectClientToModify').value;
        var newClientName = document.getElementById('modifyClientName').value;
        var newClientUsername = document.getElementById('modifyClientUsername').value;
        var newClientPassword = document.getElementById('modifyClientPassword').value;
        var oldClientPassword = document.getElementById('oldClientPassword').value;

        if (selectedClient && oldClientPassword) {
            // Send the modified client data to the server
            fetch('/modify_client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: selectedClient,
                    new_name: newClientName || null,
                    username: newClientUsername || null,
                    password: newClientPassword || null,
                    old_password: oldClientPassword
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Client Modified',
                        text: 'The client information has been modified successfully!',
                    }).then(() => {
                        location.reload(); // Reload the page to reflect the modified client in the dropdown
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Old password is required!',
            });
        }
    };
});

// Check if the selected client has a password
function checkPasswordForClient(clientName) {
    return fetch('/check_password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'client': clientName })
    }).then(response => response.json());
}

// Save the password for the selected client
function saveClientPassword(clientName, password) {
    return fetch('/save_password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'client': clientName,
            'password': password
        })
    }).then(response => response.json());
}

// Proceed with CAPTCHA and file download after saving the password
function proceedWithCaptcha(selectedClient, finYear, quarter, period) {
    Swal.fire({
        title: 'Processing...',
        html: '<p id="progressText">Fetching CAPTCHA...</p>',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            startProgressPolling();
        }
    });

    fetchCaptcha(selectedClient).then(captchaImage => {
        Swal.close(); // Close the loading spinner
        document.getElementById('captchaImage').src = 'data:image/png;base64,' + captchaImage;
        document.getElementById('client_name').value = selectedClient;
        document.getElementById('captchaModal').style.display = 'block';

        // Handle CAPTCHA submission
        document.getElementById('captchaForm').onsubmit = function(event) {
            event.preventDefault();
            var captchaValue = document.getElementById('captcha_input').value;

            Swal.fire({
                title: 'Processing...',
                html: '<p id="progressText">Submitting CAPTCHA...</p>',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                    startProgressPolling();
                }
            });

            // Perform search and download files
            performSearch(selectedClient, captchaValue, finYear, quarter, period).then(blob => {
                Swal.close(); // Close the processing message
                downloadFile(blob, selectedClient, finYear, period);
            }).catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Search failed: ' + error.message,
                });
            }).finally(() => {
                document.getElementById('captchaModal').style.display = 'none';
            });
        };
    }).catch(error => {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Failed to fetch CAPTCHA: ' + error.message,
        });
    });
}

// Fetch CAPTCHA image
function fetchCaptcha(clientName) {
    return fetch('/get_captcha', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'client': clientName })
    })
    .then(response => response.json())
    .then(data => data.captcha_image);
}

// Perform search and file download
function performSearch(clientName, captchaInput, finYear, quarter, period) {
    return fetch('/perform_search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'client_name': clientName,
            'captcha_input': captchaInput,
            'fin_year': finYear,
            'quarter': quarter,
            'period': period
        })
    })
    .then(response => {
        if (response.ok) {
            return response.blob(); // Handle the ZIP file response as a blob
        } else {
            return response.json().then(err => { throw new Error(err.message); });
        }
    });
}

// Download the file
function downloadFile(blob, clientName, finYear, period) {
    var downloadLink = document.createElement('a');
    var fileName = `${clientName}_${finYear}_${period}.zip`; // Construct the filename
    downloadLink.href = window.URL.createObjectURL(blob);
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    Swal.fire({
        icon: 'success',
        title: 'File Downloaded!',
        text: 'Your file is successfully downloaded.',
        timer: 3000,
        showConfirmButton: false
    });
}

// Poll the server for progress updates
function startProgressPolling() {
    const progressText = document.getElementById('progressText');
    const intervalId = setInterval(() => {
        fetch('/progress')
            .then(response => response.json())
            .then(data => {
                if (data.progress) {
                    progressText.innerText = data.progress;
                }
                if (data.progress === 'Completed' || data.progress.includes('Error')) {
                    clearInterval(intervalId);
                }
            })
            .catch(error => {
                progressText.innerText = 'Error fetching progress';
                clearInterval(intervalId);
            });
    }, 1000);
}

// Toggle password visibility
function togglePassword(id) {
    var passwordField = document.getElementById(id);
    if (passwordField.type === "password") {
        passwordField.type = "text";
    } else {
        passwordField.type = "password";
    }
}
