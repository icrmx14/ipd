// Wait for the page to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
    
    // Get references to the HTML elements
    const callButton = document.getElementById("callButton");
    const responseContent = document.getElementById("content");
    const spinner = document.getElementById("spinner");
    const responseCard = document.getElementById("response");

    // Function to handle the API call
    const fetchBackend = async () => {
        // 1. Reset the UI
        responseContent.innerHTML = "";
        responseCard.classList.remove("error");
        spinner.style.display = "block";
        callButton.disabled = true;

        try {
            // 2. Call your HAProxy backend
            // This is the only URL you need to change if your port is different
            const response = await fetch("http://localhost:8080/");

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // 3. Display the successful response
            displayResponse(data);

        } catch (error) {
            // 4. Display an error message
            displayError(error);
        } finally {
            // 5. Always re-enable the button and hide the spinner
            spinner.style.display = "none";
            callButton.disabled = false;
        }
    };

    // Function to render the server response
    const displayResponse = (data) => {
        // Get the last digit of the hostname (e.g., habasic-app-10 -> 0)
        // This is used to pick a consistent color
        const serverNum = parseInt(data.server_id.slice(-1), 10) % 10;
        
        responseContent.innerHTML = `
            <div class="response-content">
                <h3 class="server-${serverNum}">Server ${data.server_id}</h3>
                <p>${data.message}</p>
                <small>Timestamp: ${data.timestamp}</small>
            </div>
        `;
    };

    // Function to render an error
    const displayError = (error) => {
        responseCard.classList.add("error");
        responseContent.innerHTML = `
            <strong>Error:</strong> Failed to connect to backend.<br>
            <small>${error.message}</small>
        `;
    };

    // Attach the event listener to the button
    callButton.addEventListener("click", fetchBackend);
});