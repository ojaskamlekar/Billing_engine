from sklearn.linear_model import LinearRegression
import numpy as np

def predict_storage(storage_history):

    days = np.array(range(len(storage_history))).reshape(-1, 1)

    usage = np.array(storage_history)

    model = LinearRegression()

    model.fit(days, usage)

    future_day = np.array([[30]])

    prediction = model.predict(future_day)

    return prediction[0]