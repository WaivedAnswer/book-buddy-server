 const OpenAI = require("openai");

exports.handler = async (event) => {
    const functionName = "create_book_recommendation";
    const STRING_TYPE = "string";
    const OBJECT_TYPE = "object"
    const ARRAY_TYPE = "array"
    const functions = [ {
        name: functionName,
        description: "Creates personalized book recommendation",
        parameters: {
            type: OBJECT_TYPE,
            properties: {
                results: {
                    type: ARRAY_TYPE,
                    items: {
                        type: OBJECT_TYPE,
                    properties: {
                        title: {
                            type: STRING_TYPE,
                            description: "Book Title"
                        },
                        author: {
                            type: STRING_TYPE,
                            description: "Book Author"
                        },
                        reason: {
                            type: "string",
                            description: "Sales pitch to the user on the most valuable things they will get from the book."
                        } 
                    },
                    required: ["title", "author", "reason"]
                    }
                }
            }
        }
    }]
    const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

    const lookingFor = event.lookingFor
    console.log(event, lookingFor)
    const chatResponse = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: [
                {role: "system", "content": "You give great book recommendations. Limit to top 5 responses."},
                {role: "user", "content": lookingFor},
            ],
            functions: functions,
            function_call: {name: functionName}
        });

    const bookRecommendationCall = chatResponse.choices[0].message.function_call
    if(!bookRecommendationCall || bookRecommendationCall.name !== functionName) {
        return []
    }

    const recommendations = JSON.parse(bookRecommendationCall.arguments)

    const response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Allows access from any origin
            "Access-Control-Allow-Credentials": true
        },
        body: JSON.stringify({results: recommendations.results})
    }
    return response
};