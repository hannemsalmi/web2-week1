import {promisePool} from '../../database/db';
import CustomError from '../../classes/CustomError';
import {ResultSetHeader, RowDataPacket} from 'mysql2';
import {Cat, GetCat, PostCat, PutCat} from '../../interfaces/Cat';

const getAllCats = async (): Promise<Cat[]> => {
  const [rows] = await promisePool.execute<GetCat[]>(
    `
    SELECT cat_id, cat_name, weight, filename, birthdate, ST_X(coords) as lat, ST_Y(coords) as lng,
    JSON_OBJECT('user_id', sssf_user.user_id, 'user_name', sssf_user.user_name) AS owner 
	  FROM sssf_cat 
	  JOIN sssf_user 
    ON sssf_cat.owner = sssf_user.user_id
    `
  );
  if (rows.length === 0) {
    throw new CustomError('No cats found', 404);
  }
  const cats: Cat[] = rows.map((row) => ({
    ...row,
    owner: JSON.parse(row.owner?.toString() || '{}'),
  }));

  return cats;
};

// TODO: create getCat function to get single cat
const getCat = async (catId: number): Promise<Cat> => {
  const [rows] = await promisePool.execute<GetCat[]>(
    `
    SELECT 
      c.cat_id,
      c.cat_name,
      c.weight,
      c.filename,
      c.birthdate,
      ST_X(c.coords) AS lat,
      ST_Y(c.coords) AS lng,
      JSON_OBJECT('user_id', u.user_id, 'user_name', u.user_name) AS owner
    FROM 
      sssf_cat AS c
    JOIN 
      sssf_user AS u ON c.owner = u.user_id
    WHERE 
      c.cat_id = ?;
    `,
    [catId]
  );

  if (rows.length === 0) {
    throw new CustomError('No cat found', 404);
  }

  const cat: Cat = {
    ...rows[0],
    owner: JSON.parse(rows[0].owner?.toString() || '{}'),
  };

  return cat;
};

const addCat = async (data: PostCat): Promise<number> => {
  try {
    console.log("inside catModel addCat function", data);
    const [headers] = await promisePool.execute<ResultSetHeader>(
      `
      INSERT INTO sssf_cat (cat_name, weight, owner, filename, birthdate, coords) 
      VALUES (?, ?, ?, ?, ?, POINT(?, ?))
      `,
      [
        data.cat_name,
        data.weight,
        data.owner,
        data.filename,
        data.birthdate,
        data.lat,
        data.lng,
      ]
    );
    if (headers.affectedRows === 0) {
      throw new CustomError('No cats added', 400);
    }
    console.log(headers.info);
    return headers.insertId;
  } catch (error) {
    console.log(error);
    throw new CustomError('No cats added', 400);
  }
};

// TODO: create updateCat function to update single cat
// if role is admin, update any cat
// if role is user, update only cats owned by user
const updateCat = async (cat: PutCat, catId: number, userId: number, role: string): Promise<boolean> => {
  const values: any[] = [];
  const setClauses: string[] = [];

  const addSetClause = (columnName: string, value: any, template: string) => {
    if (value !== undefined) {
      setClauses.push(`${columnName} = ${template}`);
      values.push(value);
    }
  };

  addSetClause('cat_name', cat.cat_name, '?');
  addSetClause('weight', cat.weight, '?');
  addSetClause('coords', cat.lat && cat.lng ? 'POINT(?, ?)' : undefined, 'POINT(?, ?)');
  
  if (role !== 'admin') {
    setClauses.push('owner = ?');
    values.push(userId);
  }

  values.push(catId);

  const setClause = setClauses.join(', ');

  let query = `
    UPDATE sssf_cat
    SET ${setClause}
    WHERE cat_id = ?
  `;

  if (role !== 'admin') {
    query += ' AND owner = ?';
    values.push(userId);
  }

  const [headers] = await promisePool.execute<ResultSetHeader>(query, values);

  if (headers.affectedRows === 0) {
    throw new CustomError('No cats updated', 400);
  }

  return true;
};


const deleteCat = async (catId: number): Promise<boolean> => {
  const [headers] = await promisePool.execute<ResultSetHeader>(
    `
    DELETE FROM sssf_cat 
    WHERE cat_id = ?;
    `,
    [catId]
  );
  if (headers.affectedRows === 0) {
    throw new CustomError('No cats deleted', 400);
  }
  return true;
};

export {getAllCats, getCat, addCat, updateCat, deleteCat};