const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Route to handle CSV file upload
app.post('/upload-csv', upload.single('file'), (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.file.filename);
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading file' });
        }

        const rows = data.split('\n').map(row => row.trim()).filter(row => row);
        const parsedData = rows.map(row => {
            const [client_id, country_name, country_code, businessUnit] = row.split(',').map(item => item.trim());
            return { client_id, country_name, country_code, businessUnit };
        });

        // Clean up file
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
        });

        res.json({ data: parsedData });
    });
});

// Route to handle posting data
app.post('/post-country-data', async (req, res) => {
    const { client_id, country_name, country_code, businessUnit, access_token, requestBody } = req.body;

    try {
        const role_ids = await getRoleIdsForClient(client_id, access_token);

        for (const role_id of role_ids) {
            const response = await axios.post(`https://api.ingka.ikea.com/auth-service/clients/${client_id}/roles/${role_id}/rules`, 
                JSON.parse(requestBody), 
                {
                    headers: {
                        "Authorization": `Bearer ${access_token}`,
                        "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            if (response.status !== 200) {
                return res.status(response.status).json({ success: false });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error(`Error posting country data: ${error.message}`);
        res.status(500).json({ success: false });
    }
});

app.post('/get-client-roles', async (req, res) => {
    const { client_ids, access_token, application_name } = req.body;

    const clientIdArray = client_ids.split(',').map(id => id.trim());
    const results = [];

    for (const client_id of clientIdArray) {
        try {
            const response = await axios.get(`https://api.ingka.ikea.com/auth-service/clients/${client_id}/roles?service=${application_name}`, {
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                    "Content-Type": "application/json"
                }
            });

            const role_ids = response.data.results.map(role => role.id);
            const role_names = response.data.results.map(name => name.name);
            results.push({ client_id, role_ids ,role_names });
        } catch (error) {
            console.error(`Error fetching roles for client ID ${client_id}: ${error.message}`);
            results.push({ client_id, role_ids: [], error: error.message });
        }
    }

    res.json({ results });
});

// Helper function to get role IDs for a given client ID
async function getRoleIdsForClient(client_id, access_token) {
    const url = `https://api.ingka.ikea.com/auth-service/clients/${client_id}/roles?service=FMSRR`;
    const headers = {
        "Authorization": `Bearer ${access_token}`,
        "X-Backend-Service-Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
    };
    console.log(`URL ::: on :${url}`);
    console.log(`Headers ::: on :${headers}`);
    const response = await axios.get(url, { headers });
    const roles = response.data;
    console.log(`roles ::: on :${roles}`);
    return roles.results.map(role => role.id);
}
/*
// Post rule API (for Store Management)
app.post('/post-rule', async (req, res) => {
    const { client_id, role_id, access_token , requestBody1 } = req.body;

    try {
        const api_url = `https://api.ingka.ikea.com/auth-service/clients/${client_id}/roles/${role_id}/rules`;
        const json_body = {
            description: "FMSRR rule for Store",
            condition: "user.businessUnit == client.externalReference"
        };

        const response = await axios.post(api_url, json_body, {
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                "Content-Type": "application/json"
            }
        });

        res.json({ success: response.status === 200 });
    } catch (error) {
        console.error(`Error posting rule: ${error.message}`);
        res.status(500).json({ success: false });
    }
});*/
// Post rule API (for Store Management)
app.post('/post-rule', async (req, res) => {
    const { client_id, role_id, access_token, requestBody1 } = req.body; // Extract requestBody1 from the request body

    console.error(`client_id posting rule: ${client_id}`);
    console.error(`role_id posting rule: ${role_id}`);
    console.error(`requestBody1 posting rule: ${requestBody1}`);

    try {
        const api_url = `https://XXXapi.ingka.ikea.com/auth-service/clients/${client_id}/roles/${role_id}/rules`;

        // Parse requestBody1 as it is coming from the client in string format
        const json_body = JSON.parse(requestBody1);
        console.error(`json_body posting rule: ${json_body}`);
        const response = await axios.post(api_url, json_body, {
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                "Content-Type": "application/json"
            }
        });

        res.json({ success: response.status === 200 });
    } catch (error) {
        console.error(`Error posting rule: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// API route to fetch services from IKEA API
app.get('/api/services', async (req, res) => {
    const { access_token } = req.query; // Get access token from query params

    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        const response = await axios.get('https://api.ingka.ikea.com/auth-service/services', {
            headers: {
                "Authorization": `Bearer ${access_token}`,
        "X-Backend-Service-Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
            }
        });

        // Send the result of the IKEA API to the frontend
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching services: API route to fetch services from IKEA API', error.message);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});


// API route to fetch all clients and their roles for a specific service
app.get('/api/clients-with-roles', async (req, res) => {
    const { access_token, service } = req.query;

    if (!access_token || !service) {
        return res.status(400).json({ error: 'Access token and service are required' });
    }

    try {
        // Step 1: Function to fetch all clients (handling pagination)
        const fetchAllClients = async () => {
            let allClients = [];
            let nextPageUrl = 'https://api.ingka.ikea.com/auth-service/clients?perPage=1000&page=1&hierarchicallyType=CHILDREN&hierarchicallyFromClient=2&omitCount=false&q=CTY.&omitDetails=true';

           // let nextPageUrl = 'https://api.ingka.ikea.com/auth-service/clients'; // Initial API URL
            while (nextPageUrl) {
                const clientsResponse = await axios.get(nextPageUrl, {
                    headers: {
                        "Authorization": `Bearer ${access_token}`,
                        "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                        "Content-Type": "application/json"
                    }
                });
    
                // Append the results to allClients array
                allClients.push(...clientsResponse.data.results);
                
                // Check if there's a next page (assuming API returns a `next` field for pagination)
                nextPageUrl = clientsResponse.data.next || null; // Set to null if no more pages
            }
            console.error(`allClients:-------------- ${allClients} `);
            return allClients;
        };
    
        // Fetch all clients
        const clients = await fetchAllClients();
        const clientIds = clients.map(client => client.id); // Extract the client IDs
        console.error(`Fetching roles for clientIds: ${clientIds} `);
    
        // Step 2: Fetch roles for each client for the specified service
       /* for (const client of clientIds) {
            try {
                console.error(`Fetching roles for client: ${client} with service: ${service}`);
                const rolesResponse = await axios.get(`https://api.ingka.ikea.com/auth-service/clients/${client}/roles?service=${service}`, {
                    headers: {
                        "Authorization": `Bearer ${access_token}`,
                        "X-Backend-Service-Authorization": `Bearer ${access_token}`,
                        "Content-Type": "application/json"
                    }
                });
    
                // Extract role IDs from the response
                const roles = rolesResponse.data.results.map(role => role.role_id); 
                console.error(`Fetched roles for client ${client}: ${roles}`);
    
                // Store the client and its roles
                clientsWithRoles.push({
                    client_id: client,
                    roles: roles
                });
            } catch (roleError) {
                console.error(`Error fetching roles for client ${client}: ${roleError.message}`);
            }
        }*/
    
        // Log and send the clients and their roles to the frontend
        res.json(clientIds);
        console.error(` Respose sent for roles for clientIds: ${clientIds} `);
    } catch (error) {
        console.error('Error fetching clients or roles:', error.message);
        res.status(500).json({ error: 'Failed to fetch clients or roles' });
    }
    
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
path.normalize