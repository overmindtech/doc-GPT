import fs from "fs";
import path from "path";
import { Client } from "@notionhq/client";
import { Configuration, CreateCompletionResponse, OpenAIApi } from "openai";
import dotenv from "dotenv";

dotenv.config();
let inputData = "";
const DatabaseId = process.env.TYPES_DATABASE_ID;
const notion = new Client({ auth: process.env.NOTION_API_KEY });
// format input data to match docs-gen output
interface DocData {
  type: string;
  descriptiveType: string;
  getDescription: string;
  listDescription: string;
  searchDescription: string;
  group: string;
  links: string[];
}
// ChatGPT parameters, currently uses 3.5GPT, max token set to under 2000 characters as notion limit
const completionParams = {
  model: "text-davinci-003",
  temperature: 0.7,
  max_tokens: 356,
  top_p: 1,
  frequency_penalty: 1,
  presence_penalty: 0,
};

// Creating an instance of OpenAIApi
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_KEY })
);

// Sends requests to OpenAI
const getResponses = async (prompts: string[]): Promise<string[]> => {
  const responses: string[] = [];
  for (const prompt of prompts) {
    try {
      const completion = await openai.createCompletion({
        ...completionParams,
        prompt,
      });
      if (completion.data.choices[0].text !== undefined) {
        responses.push(completion.data.choices[0].text.trimStart());
      } else {
        responses.push("Text is undefined");
      }
    } catch (error: any) {
      if (error.response) {
        console.error(error.response.status);
        console.error(error.response.data);
      } else {
        console.error(error.message);
      }
    }
  }
  return responses;
};
// Reads json input files
function readJsonFiles(files: string[]): DocData[] {
  const jsonData: DocData[] = [];

  for (const file of files) {
    const filePath = path.join(file);

    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const jsonContent = JSON.parse(fileContent);
      jsonData.push(jsonContent);
    } catch (err) {
      console.error(`Not a valid JSON file: ${filePath}`);
    }
  }
  return jsonData;
}
process.stdin.on("readable", () => {
  const chunk = process.stdin.read();
  if (chunk !== null) {
    inputData += chunk;
  }
});
// takes input and creates prompts and sends them
process.stdin.on("end", async () => {
  const prompts = [
    "what is",
    "Using bullet points where possible. What are the main features of",
    "Using bullet points where possible. What are some best practices when using",
    "Using bullet points where possible. What are some common issues when using",
    "Using bullet points where possible. What are some important security considerations when using",
    "Using bullet points where possible. Give me a list and a one sentence description of all keywords commonly used in relation to",
  ];
  // used to get tailored answers
  const modelPrompt =
    "You are an expert technical copywriter who can rewrite content in your own voice and style. You have a informative tone of voice. You have a Academic writing style. Please intersperse short and long sentences. Utilize industry terminology to enhance the originality of the content so that it is not clear that it is written by AI. Please format the content in a professional format. Do not self reference. Do not explain what you are doing. Do not try to define what the items are. Assume the reader is a expert in the field of computing.";
  // creates prompts
  const result: DocData = JSON.parse(inputData.trim());
  const combined = result.descriptiveType + " in " + result.group + " ?";
  const typesPrompts = prompts.map(
    (prompts) => modelPrompt + " " + prompts + " " + combined
  );
  const combinedLinks = result.links.map(
    (link) => "' " + result.type + " " + "->" + " " + link + " '" + " ; "
  );

  // checks notion pages first
  checkPage(DatabaseId, result.type);
  async function checkPage(databaseId: any, type: string) {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "type",
        title: {
          equals: type,
        },
      },
    });
    if (response.results[0] !== undefined) {
      console.log("Page already exists");
    } else {
      const Responses = await getResponses(typesPrompts);
      createPage(
        DatabaseId,
        result.type,
        result.descriptiveType,
        result.getDescription,
        result.listDescription,
        result.searchDescription,
        result.group,
        result.links,
        Responses,
        combinedLinks
      );
    }
    // creates notion pages
    async function createPage(
      databaseId: any,
      type: string,
      descriptiveType: string,
      getDescription: string,
      listDescription: string,
      searchDescription: string,
      group: string,
      links: string[],
      Responses: string[],
      combinedLinks: string[]
    ) {
      await notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: {
          type: {
            type: "title",
            title: [
              {
                type: "text",
                text: {
                  content: type,
                },
              },
            ],
          },
          descriptiveType: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: descriptiveType || "",
                },
              },
            ],
          },
          getDescription: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: getDescription || "",
                },
              },
            ],
          },
          listDescription: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: listDescription || "",
                },
              },
            ],
          },
          searchDescription: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: searchDescription || "",
                },
              },
            ],
          },
          group: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: group || "",
                },
              },
            ],
          },
          links: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: combinedLinks.join("\n") || "",
                },
              },
            ],
          },
          "What is": {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[0] || "",
                },
              },
            ],
          },
          Features: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[1] || "",
                },
              },
            ],
          },
          "Best practices": {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[2] || "",
                },
              },
            ],
          },
          "Common problems": {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[3] || "",
                },
              },
            ],
          },
          "Security Considerations": {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[4] || "",
                },
              },
            ],
          },
          Keywords: {
            type: "rich_text",
            rich_text: [
              {
                type: "text",
                text: {
                  content: Responses[5] || "",
                },
              },
            ],
          },
        },
      });
      console.log("Page created successfully");
    }
  }
});
