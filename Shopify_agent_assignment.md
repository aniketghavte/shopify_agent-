AI Agent for Shopify Store Analysis
Objective
Build a fullstack AI application where an AI Agent can intelligently analyze a Shopify store’s data (Orders, Products, Customers) via the official Shopify Admin REST API. The agent must answer questions, create tables, provide summaries and strategic insights, and optionally generate charts. All interaction with Shopify must be through GET requests only, using a custom-built tool.
This project will assess your ability to:
•	Design a tool-using LangChain agent
•	Connect to external APIs (Shopify REST Admin API)
•	Handle real-world API data with edge cases (rate limits, pagination, malformed data)
•	Build a user-facing interface to interact with the agent
________________________________________
Provided by Company
In the .env file, you will be provided with:
•	Shopify development store details:
o	Store URL (e.g., clevrr.myshopify.com)
o	Access token

In the PRESETS.md File you will be provided with:
•	API documentation links
•	Sample questions the agent should be able to handle

You are required to use your own FREE Gemini API Key available at https://aistudio.google.com with free usage and rate limits.
________________________________________

Functional Requirements
Agent Capabilities
•	Implemented using LangChain’s ReAct or similar Agent architecture
•	Must use tools:
1.	get_shopify_data: A custom tool for making GET requests to the Shopify Admin API
2.	You can further optimize the tool to have function specific tool for each endpoint.
3.	PythonREPLAst: For reasoning, data analysis, table creation, and chart generation (optional)
•	Should respond to queries such as:
o	“How many orders did we get in the last 7 days?”
o	“Which products are top sellers this month?”
o	“What cities generate the highest revenue?”
o	“List customers who ordered more than 3 times”
•	Should maintain chat history and context
•	Should Render:
o	Tabular summaries
o	Aggregate metrics
o	Business recommendations
o	Basic charts (bonus - but not mandatory)
Agent Must Not:
•	Use or return raw code in output
•	Make POST, PUT, DELETE requests
•	Generate fake or hallucinated metrics
Backend
•	Language: Python
•	Framework: Flask/FastAPI/Django
•	Expose API for frontend to submit chat queries and store name
•	Implement get_shopify_data tool with:
o	GET-only enforcement
o	Pagination handling
o	Rate limit handling
o	Retry logic
Frontend
•	Framework: React
•	Input: Shopify store URL + Chat interface
•	Displays:
o	Agent responses
o	Tables
o	Charts/images (if any)
________________________________________
Evaluation Criteria
Criteria	Weight
Agent Design and Prompt accuracy	50%
Shopify Tool Implementation	10%
Analytical Capabilities	10%
Frontend Integration	15%
Code Quality & Documentation	15%
________________________________________
Deliverables
•	GitHub repository containing:
o	Full source code (frontend + backend in separate folders but one repository)
o	README.md with:
	Setup steps
	Agent prompt used
	Architecture explanation
	Known issues
o	Working example questions
•	Optional: Deployed version (Bonus points for deployment, but not mandatory)
•	DO NOT expose the .env file to github with enpoints and API keys.
________________________________________
Sample Agent Questions to Support
1.	“How many orders were placed in the last 7 days?”
2.	“Which products sold the most last month?”
3.	“Show a table of revenue by city.”
4.	“Who are my repeat customers?”
5.	“What is the AOV (Average Order Value) trend this month?”
6.	“Can you recommend what product to promote based on sales?”
7.	(Bonus) “Plot a graph of order volume over the past 4 weeks.”
________________________________________
Documentation and Resources
Shopify Admin REST API (2025-07)
•	General Docs: https://shopify.dev/docs/api/admin-rest
•	Orders: https://shopify.dev/docs/api/admin-rest/2025-07/resources/order
•	Products: https://shopify.dev/docs/api/admin-rest/2025-07/resources/product
•	Customers: https://shopify.dev/docs/api/admin-rest/2025-07/resources/customer
LangChain Documentation
•	ReAct Agent: https://python.langchain.com/api_reference/langchain/agents/langchain.agents.react.base.ReActChain.html
•	Custom Tools: https://python.langchain.com/docs/how_to/custom_tools
•	Python REPL Tool (PythonREPLAst): https://python.langchain.com/api_reference/experimental/tools/langchain_experimental.tools.python.tool.PythonAstREPLTool.html
API Key (for reference)
•	API – Use the free Gemini API key on your account. ________________________________________
Notes and Edge Cases
•	All Shopify API interactions must be GET only
•	If the agent attempts an unsafe operation (POST/PUT/DELETE), it must reply: > “This operation is not permitted.”
•	Pagination is required for Shopify list endpoints (use limit and page_info params)
•	Handle API rate limits (HTTP 429) using retries with backoff
•	Validate and sanitize agent outputs before rendering
________________________________________
Please reach out if you have any questions during the assignment.
Good luck!
