document.addEventListener('DOMContentLoaded', function() {
    loadClientDetails();

    document.getElementById('addClientBtn').addEventListener('click', function() {
        openModal('addClientModal');
    });

    document.getElementById('submitAddClientBtn').addEventListener('click', function() {
        addClient();
    });

    document.getElementById('submitEditClientBtn').addEventListener('click', function() {
        modifyClient();
    });

    document.getElementById('toggleNewPassword').addEventListener('change', function() {
        togglePassword('newClientPassword');
    });

    document.getElementById('toggleEditPassword').addEventListener('change', function() {
        togglePassword('editClientPassword');
    });
});

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function loadClientDetails() {
    fetch('/get_clients')
        .then(response => response.json())
        .then(data => {
            const tableBody = document.getElementById('clientDetailsTable');
            tableBody.innerHTML = '';

            data.clients.forEach(client => {
                const row = document.createElement('tr');

                const nameCell = document.createElement('td');
                nameCell.textContent = client.name;
                row.appendChild(nameCell);

                const usernameCell = document.createElement('td');
                usernameCell.textContent = client.username;
                row.appendChild(usernameCell);

                const passwordCell = document.createElement('td');
                passwordCell.innerHTML = client.password ? '✓' : 'X';
                row.appendChild(passwordCell);

                const actionCell = document.createElement('td');
                actionCell.classList.add('client-actions');

                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-warning btn-sm';
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.onclick = function() {
                    openEditClientModal(client);
                };
                actionCell.appendChild(editBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-sm';
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.onclick = function() {
                    deleteClient(client.name);
                };
                actionCell.appendChild(deleteBtn);

                row.appendChild(actionCell);
                tableBody.appendChild(row);
            });
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to load client details: ' + error.message,
            });
        });
}

function openEditClientModal(client) {
    document.getElementById('editClientName').value = client.name;
    document.getElementById('editClientUsername').value = client.username;
    openModal('editClientModal');
}

function resetAddClientForm() {
    document.getElementById('newClientName').value = '';
    document.getElementById('newClientUsername').value = '';
    document.getElementById('newClientPassword').value = '';
    document.getElementById('xlsxFile').value = '';
}

function resetEditClientForm() {
    document.getElementById('editClientName').value = '';
    document.getElementById('editClientUsername').value = '';
    document.getElementById('editClientPassword').value = '';
}

function addClient() {
    const clientName = document.getElementById('newClientName').value;
    const clientUsername = document.getElementById('newClientUsername').value;
    const clientPassword = document.getElementById('newClientPassword').value;
    const xlsxFile = document.getElementById('xlsxFile').files[0];

    if (xlsxFile) {
        const formData = new FormData();
        formData.append('xlsxFile', xlsxFile);

        fetch('/add_client', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Clients Added',
                    text: 'Clients have been added from the XLSX file successfully!',
                }).then(() => {
                    resetAddClientForm();  // Reset fields after success
                    closeModal('addClientModal');
                    loadClientDetails();
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        });
    } else if (clientName && clientUsername && clientPassword) {
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
                    resetAddClientForm();  // Reset fields after success
                    closeModal('addClientModal');
                    loadClientDetails();
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
            text: 'All fields or a valid XLSX file are required!',
        });
    }
}

function modifyClient() {
    const name = document.getElementById('editClientName').value;
    const username = document.getElementById('editClientUsername').value;
    const password = document.getElementById('editClientPassword').value;

    fetch('/modify_client', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            username: username,
            password: password,
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Client Modified',
                text: 'The client has been modified successfully!',
            }).then(() => {
                resetEditClientForm();  // Reset fields after success
                closeModal('editClientModal');
                loadClientDetails();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message,
            });
        }
    });
}

function deleteClient(clientName) {
    fetch('/delete_client', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: clientName,
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Client Deleted',
                text: 'The client has been deleted successfully!',
            }).then(() => {
                loadClientDetails();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: data.message,
            });
        }
    });
}

function togglePassword(id) {
    const passwordField = document.getElementById(id);
    passwordField.type = passwordField.type === 'password' ? 'text' : 'password';
}
