import os

def clear_console():
    if os.name == 'nt':
        os.system('cls')
    else:
        os.system('clear')

def install_dependencies():
    print("***INSTALLING DEPENDENCIES***")

    # Install dependencies
    os.system('pip install flask')
    os.system('pip install selenium')
    os.system('pip install pyyaml')
    os.system('pip install pandas')
    # os.system('pip install webdriver-manager')

    clear_console()

    print("Dependencies installed successfully!")

if __name__ == "__main__":
    install_dependencies()
