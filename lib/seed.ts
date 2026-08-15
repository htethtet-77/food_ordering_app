import { ID } from "react-native-appwrite";
import { appwriteConfig, databases, storage } from "./appwrite";
import dummyData from "./data";
import * as FileSystem from "expo-file-system/legacy";

interface Category {
  name: string;
  description: string;
}

interface Customization {
  name: string;
  price: number;
  type: "topping" | "side" | "size" | "crust" | string;
}

interface MenuItem {
  name: string;
  description: string;
  image_url: string;
  price: number;
  rating: number;
  calories: number;
  protein: number;
  category_name: string;
  customizations: string[];
}

interface DummyData {
  categories: Category[];
  customizations: Customization[];
  menu: MenuItem[];
}

const data = dummyData as DummyData;

// ---------------------------------------------
// Clear all documents from a collection
// ---------------------------------------------
async function clearAll(collectionId: string): Promise<void> {
  const list = await databases.listDocuments(
    appwriteConfig.databaseId,
    collectionId
  );

  console.log(
    `🗑 Clearing ${collectionId}: ${list.documents.length} documents`
  );

  for (const doc of list.documents) {
    try {
      await databases.deleteDocument(
        appwriteConfig.databaseId,
        collectionId,
        doc.$id
      );

      console.log(`✅ Deleted ${doc.$id}`);
    } catch (error: any) {
      console.warn(
        `⚠️ Failed to delete ${doc.$id}:`,
        error?.message
      );
    }
  }
}

// ---------------------------------------------
// Clear all files from storage
// ---------------------------------------------
async function clearStorage(): Promise<void> {
  const list = await storage.listFiles(
    appwriteConfig.bucketId
  );

  console.log(
    `🗑 Clearing storage: ${list.files.length} files`
  );

  await Promise.all(
    list.files.map((file) =>
      storage.deleteFile(
        appwriteConfig.bucketId,
        file.$id
      )
    )
  );

  console.log("✅ Storage cleared");
}

// ---------------------------------------------
// Download image and upload to Appwrite Storage
// ---------------------------------------------
async function uploadImageToStorage(imageUrl: string) {
  const fileName =
    imageUrl.split("/").pop()?.split("?")[0] ||
    `file-${Date.now()}.png`;

  const localUri = `${FileSystem.cacheDirectory}${fileName}`;

  console.log("⬇️ Downloading:", imageUrl);
  console.log("📁 Local URI:", localUri);

  const downloadResult = await FileSystem.downloadAsync(
    imageUrl,
    localUri
  );

  console.log("📥 Download result:", downloadResult);

  if (downloadResult.status !== 200) {
    throw new Error(
      `Failed to download image: ${downloadResult.status}`
    );
  }

  const fileInfo =
    await FileSystem.getInfoAsync(localUri);

  console.log("📄 File info:", fileInfo);

  if (!fileInfo.exists) {
    throw new Error(
      "Downloaded file does not exist"
    );
  }

  const fileObj = {
    name: fileName,
    type: "image/png",
    size: fileInfo.size,
    uri: localUri,
  };

  console.log(
    "📤 Uploading to Appwrite:",
    fileObj
  );

  const file = await storage.createFile(
    appwriteConfig.bucketId,
    ID.unique(),
    fileObj
  );

  console.log(
    "✅ Upload done:",
    file.$id
  );

  return storage.getFileViewURL(
    appwriteConfig.bucketId,
    file.$id
  );
}

// ---------------------------------------------
// Seed database
// ---------------------------------------------
async function seed(): Promise<void> {
  try {
    console.log("🌱 Starting seed...");

    // -----------------------------------------
    // 1. Clear existing data
    // -----------------------------------------

    console.log("🧹 Clearing existing data...");

    await clearAll(
      appwriteConfig.categoriesCollectionId
    );

    await clearAll(
      appwriteConfig.customizationsCollectionId
    );

    await clearAll(
      appwriteConfig.menuCollectionId
    );

    await clearAll(
      appwriteConfig.menuCustomizationsCollectionId
    );

    await clearStorage();

    console.log("✅ Existing data cleared");

    // -----------------------------------------
    // 2. Create Categories
    // -----------------------------------------

    console.log("📂 Creating categories...");

    const categoryMap: Record<string, string> = {};

    for (const cat of data.categories) {
      console.log(
        `📂 Creating category: ${cat.name}`
      );

      const doc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.categoriesCollectionId,
        ID.unique(),
        {
          name: cat.name,
          description: cat.description,
        }
      );

      categoryMap[cat.name] = doc.$id;

      console.log(
        `✅ Category created: ${cat.name}`
      );
    }

    // -----------------------------------------
    // 3. Create Customizations
    // -----------------------------------------

    console.log("🧂 Creating customizations...");

    const customizationMap: Record<string, string> =
      {};

    for (const cus of data.customizations) {
      console.log(
        `🧂 Creating customization: ${cus.name}`
      );

      const doc = await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.customizationsCollectionId,
        ID.unique(),
        {
          name: cus.name,
          price: cus.price,
          type: cus.type,
        }
      );

      customizationMap[cus.name] = doc.$id;

      console.log(
        `✅ Customization created: ${cus.name}`
      );
    }

    // -----------------------------------------
    // 4. Create Menu Items
    // -----------------------------------------

    console.log("🍔 Starting menu seeding...");

    const menuMap: Record<string, string> = {};

    for (const item of data.menu) {
      console.log(
        `🍔 Seeding menu: ${item.name}`
      );

      try {
        // -------------------------------------
        // Upload image
        // -------------------------------------

        const uploadedImage =
          await uploadImageToStorage(
            item.image_url
          );

        // -------------------------------------
        // Find category
        // -------------------------------------

        const categoryId =
          categoryMap[item.category_name];

        if (!categoryId) {
          throw new Error(
            `Category not found: ${item.category_name}`
          );
        }

        // -------------------------------------
        // Create menu document
        // -------------------------------------

        const doc =
          await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.menuCollectionId,
            ID.unique(),
            {
              name: item.name,
              description: item.description,
              image_url: uploadedImage,
              price: item.price,
              rating: item.rating,
              calories: item.calories,
              protein: item.protein,
              categories: categoryId,
            }
          );

        menuMap[item.name] = doc.$id;

        console.log(
          `✅ Menu created: ${item.name}`
        );

        // -------------------------------------
        // Create menu-customization relations
        // -------------------------------------

        for (const cusName of item.customizations) {
          const customizationId =
            customizationMap[cusName];

          if (!customizationId) {
            throw new Error(
              `Customization not found: ${cusName}`
            );
          }

          await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.menuCustomizationsCollectionId,
            ID.unique(),
            {
              menu: doc.$id,
              customizations: customizationId,
            }
          );

          console.log(
            `🔗 Linked ${item.name} → ${cusName}`
          );
        }

        console.log(
          `✅ ${item.name} seeded successfully`
        );
      } catch (error) {
        console.error(
          `❌ Failed to seed menu: ${item.name}`,
          error
        );

        throw error;
      }
    }

    // -----------------------------------------
    // 5. Finished
    // -----------------------------------------

    console.log("================================");
    console.log("🎉 SEEDING COMPLETE");
    console.log("================================");

    console.log(
      `Categories: ${Object.keys(categoryMap).length}`
    );

    console.log(
      `Customizations: ${
        Object.keys(customizationMap).length
      }`
    );

    console.log(
      `Menu items: ${Object.keys(menuMap).length}`
    );
  } catch (error) {
    console.error(
      "❌ SEEDING FAILED:",
      error
    );

    throw error;
  }
}

export default seed;